using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;
using System.Collections.Concurrent;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(
    AppDbContext dbContext,
    IBackgroundJobClient backgroundJobClient,
    IServiceScopeFactory scopeFactory,
    ILogger<EmployeesController> logger) : ControllerBase
{
    private static readonly string[] DefaultEmploymentStatuses = ["Active", "Inactive", "Maternity"];
    private static readonly ConcurrentDictionary<Guid, BulkEmployeeCsvJobStatusResponse> CsvImportJobs = new();
    private static readonly string[] CsvStaticHeaders =
    [
        "EmployeeCode",
        "FullName",
        "Email",
        "Phone",
        "Department",
        "Designation",
        "Address",
        "FatherName",
        "MotherName",
        "SpouseName",
        "FatherPhone",
        "MotherPhone",
        "SpousePhone",
        "Gender",
        "Religion",
        "MaritalStatus",
        "BloodGroup",
        "NationalId",
        "EmploymentStatus",
        "WorkingTime",
        "SalaryRule",
        "GrossSalary",
        "BasicSalary",
        "Weekend",
        "SalaryAccount",
        "DateOfBirth",
        "JoiningDate"
    ];

    [HttpGet("attribute-suggestions")]
    public async Task<ActionResult<IEnumerable<string>>> GetAttributeSuggestions(
        [FromQuery] string? query,
        [FromQuery] int take = 10,
        CancellationToken cancellationToken = default)
    {
        var safeTake = Math.Clamp(take, 1, 30);
        var keyCounts = await GetDynamicAttributeKeyCounts(cancellationToken);
        if (keyCounts.Count == 0)
        {
            return Ok(Array.Empty<string>());
        }

        var normalizedQuery = NormalizeKey(query ?? string.Empty);
        IEnumerable<KeyValuePair<string, int>> ranked;

        if (string.IsNullOrWhiteSpace(normalizedQuery))
        {
            ranked = keyCounts.OrderByDescending(x => x.Value).ThenBy(x => x.Key);
        }
        else
        {
            ranked = keyCounts
                .Select(x => new
                {
                    Key = x.Key,
                    Count = x.Value,
                    Score = CalculateSuggestionScore(normalizedQuery, NormalizeKey(x.Key))
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenByDescending(x => x.Count)
                .ThenBy(x => x.Key)
                .Select(x => new KeyValuePair<string, int>(x.Key, x.Count));
        }

        return Ok(ranked.Take(safeTake).Select(x => x.Key).ToArray());
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<EmployeeResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? department = null,
        [FromQuery] string? designation = null,
        [FromQuery] DateOnly? joiningDateFrom = null,
        [FromQuery] DateOnly? joiningDateTo = null,
        CancellationToken cancellationToken = default)
    {
        if (joiningDateFrom.HasValue && joiningDateTo.HasValue && joiningDateFrom > joiningDateTo)
        {
            return BadRequest("joiningDateFrom cannot be later than joiningDateTo.");
        }

        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 5, 100);

        var query = ApplyEmployeeFilters(
            dbContext.Employees.AsNoTracking().AsQueryable(),
            search,
            department,
            designation,
            joiningDateFrom,
            joiningDateTo);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)safePageSize);

        var employees = await query
            .OrderBy(x => x.FullName)
            .ThenBy(x => x.EmployeeCode)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EmployeeResponse>
        {
            Items = employees.Select(MapToResponse).ToArray(),
            TotalCount = totalCount,
            Page = safePage,
            PageSize = safePageSize,
            TotalPages = totalPages
        });
    }

    [HttpGet("status-options")]
    public async Task<ActionResult<IEnumerable<string>>> GetStatusOptions(CancellationToken cancellationToken)
    {
        var dbStatuses = await dbContext.Employees
            .AsNoTracking()
            .Where(x => x.EmploymentStatus != null && x.EmploymentStatus.Trim() != string.Empty)
            .Select(x => x.EmploymentStatus!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var allStatuses = DefaultEmploymentStatuses
            .Concat(dbStatuses)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return Ok(allStatuses);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] string? search = null,
        [FromQuery] string? department = null,
        [FromQuery] string? designation = null,
        [FromQuery] DateOnly? joiningDateFrom = null,
        [FromQuery] DateOnly? joiningDateTo = null,
        CancellationToken cancellationToken = default)
    {
        if (joiningDateFrom.HasValue && joiningDateTo.HasValue && joiningDateFrom > joiningDateTo)
        {
            return BadRequest("joiningDateFrom cannot be later than joiningDateTo.");
        }

        var employees = await ApplyEmployeeFilters(
                dbContext.Employees.AsNoTracking().AsQueryable(),
                search,
                department,
                designation,
                joiningDateFrom,
                joiningDateTo)
            .OrderBy(x => x.FullName)
            .ThenBy(x => x.EmployeeCode)
            .ToListAsync(cancellationToken);

        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var fileName = $"employees_{timestamp}.csv";
        var bytes = BuildCsv(employees);
        return File(bytes, "text/csv", fileName);
    }

    [HttpPost("import-update")]
    public async Task<ActionResult<BulkEmployeeCsvUpdateResponse>> ImportUpdateByCsv(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        var uploadValidation = await ReadAndValidateCsvUploadAsync(file, cancellationToken);
        if (!uploadValidation.IsValid)
        {
            return BadRequest(uploadValidation.Error!);
        }

        try
        {
            var result = await ProcessCsvUpdateContentAsync(uploadValidation.Content!, dbContext, cancellationToken);
            return Ok(result);
        }
        catch (CsvValidationException ex)
        {
            return BadRequest(new BulkEmployeeCsvUpdateResponse
            {
                Message = ex.Message,
                Errors = ex.Errors.ToList()
            });
        }
    }

    [HttpPost("import-update/background")]
    public async Task<ActionResult<BulkEmployeeCsvJobAcceptedResponse>> ImportUpdateByCsvInBackground(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        var uploadValidation = await ReadAndValidateCsvUploadAsync(file, cancellationToken);
        if (!uploadValidation.IsValid)
        {
            return BadRequest(uploadValidation.Error!);
        }

        PruneOldCsvJobs();

        var jobId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var tempFilePath = await SaveCsvContentToTempFileAsync(jobId, uploadValidation.Content!, cancellationToken);
        CsvImportJobs[jobId] = new BulkEmployeeCsvJobStatusResponse
        {
            JobId = jobId,
            Status = "Queued",
            Message = "CSV import is queued.",
            ProgressPercent = 0,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var hangfireJobId = backgroundJobClient.Enqueue<EmployeesController>(x => x.ProcessCsvImportJobAsync(jobId, tempFilePath));
        UpdateCsvJob(jobId, status =>
        {
            status.HangfireJobId = hangfireJobId;
            status.Message = "CSV file accepted. Processing started in Hangfire queue.";
            status.UpdatedAtUtc = DateTime.UtcNow;
        });

        return Accepted(new BulkEmployeeCsvJobAcceptedResponse
        {
            JobId = jobId,
            HangfireJobId = hangfireJobId,
            Status = "Queued",
            Message = "CSV file accepted. Processing started in Hangfire queue."
        });
    }

    [HttpGet("import-update/jobs/{jobId:guid}")]
    public ActionResult<BulkEmployeeCsvJobStatusResponse> GetCsvImportJobStatus(Guid jobId)
    {
        if (!CsvImportJobs.TryGetValue(jobId, out var status))
        {
            return NotFound($"CSV import job '{jobId}' not found.");
        }

        return Ok(status);
    }

    [HttpPost("import-update/jobs/{jobId:guid}/cancel")]
    public ActionResult<BulkEmployeeCsvJobStatusResponse> CancelCsvImportJob(Guid jobId)
    {
        if (!CsvImportJobs.TryGetValue(jobId, out var status))
        {
            return NotFound($"CSV import job '{jobId}' not found.");
        }

        if (status.Status is "Completed" or "Failed" or "Canceled")
        {
            return Ok(status);
        }

        var now = DateTime.UtcNow;
        status.CancellationRequested = true;
        status.UpdatedAtUtc = now;

        if (status.Status == "Queued" && !string.IsNullOrWhiteSpace(status.HangfireJobId))
        {
            BackgroundJob.Delete(status.HangfireJobId);
            status.Status = "Canceled";
            status.Message = "CSV import canceled before processing started.";
            status.CompletedAtUtc = now;
            status.ProgressPercent ??= 0;
        }
        else
        {
            status.Message = "CSV cancel requested. Job will stop shortly.";
        }

        return Ok(status);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (employee is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(employee));
    }

    [HttpGet("exists/{code}")]
    public async Task<ActionResult<bool>> CheckCode(long code, [FromQuery] Guid? excludeId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Employees
            .AnyAsync(x => x.EmployeeCode == code && (excludeId == null || x.Id != excludeId), cancellationToken);
        return Ok(exists);
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeResponse>> Create(
        [FromBody] EmployeeCreateRequest request,
        CancellationToken cancellationToken)
    {
        var requiredFieldError = ValidateRequiredEmployeeFields(
            request.DepartmentId,
            request.Department,
            request.DesignationId,
            request.Designation,
            request.Gender,
            request.DateOfBirth);
        if (requiredFieldError is not null)
        {
            return BadRequest(requiredFieldError);
        }

        if (await dbContext.Employees.AnyAsync(x => x.EmployeeCode == request.EmployeeCode, cancellationToken))
        {
            return Conflict($"Employee with code '{request.EmployeeCode}' already exists.");
        }

        var departmentResolutionResult = await ResolveOrCreateDepartmentAsync(
            dbContext,
            request.DepartmentId,
            request.Department,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(departmentResolutionResult.Error))
        {
            return BadRequest(departmentResolutionResult.Error);
        }

        var departmentResolution = departmentResolutionResult.Value;
        if (departmentResolution is null)
        {
            return BadRequest("Department is required.");
        }

        var designationResolutionResult = await ResolveOrCreateDesignationAsync(
            dbContext,
            request.DesignationId,
            request.Designation,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(designationResolutionResult.Error))
        {
            return BadRequest(designationResolutionResult.Error);
        }

        var designationResolution = designationResolutionResult.Value;
        if (designationResolution is null)
        {
            return BadRequest("Designation is required.");
        }

        var shiftResolutionResult = await ResolveOrCreateShiftAsync(
            dbContext,
            request.ShiftId,
            request.WorkingTime,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(shiftResolutionResult.Error))
        {
            return BadRequest(shiftResolutionResult.Error);
        }

        var shiftResolution = shiftResolutionResult.Value;

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = request.EmployeeCode,
            FullName = request.FullName.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone.Trim(),
            DepartmentId = departmentResolution.Id,
            Department = departmentResolution.Name,
            DesignationId = designationResolution.Id,
            Designation = designationResolution.Name,
            Address = request.Address?.Trim(),
            FatherName = request.FatherName?.Trim(),
            MotherName = request.MotherName?.Trim(),
            SpouseName = request.SpouseName?.Trim(),
            FatherPhone = request.FatherPhone?.Trim(),
            MotherPhone = request.MotherPhone?.Trim(),
            SpousePhone = request.SpousePhone?.Trim(),
            Gender = request.Gender.Trim(),
            Religion = request.Religion?.Trim(),
            MaritalStatus = request.MaritalStatus?.Trim(),
            BloodGroup = request.BloodGroup?.Trim(),
            NationalId = request.NationalId?.Trim(),
            EmploymentStatus = request.EmploymentStatus.Trim(),
            Photo = FromBase64(request.PhotoBase64),
            Signature = FromBase64(request.SignatureBase64),
            ShiftId = shiftResolution?.Id,
            WorkingTime = shiftResolution?.DisplayName,
            SalaryRule = request.SalaryRule?.Trim(),
            GrossSalary = request.GrossSalary,
            BasicSalary = request.BasicSalary,
            Weekend = request.Weekend?.Trim(),
            SalaryAccount = request.SalaryAccount?.Trim(),
            DateOfBirth = request.DateOfBirth,
            JoiningDate = request.JoiningDate,
            DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys)
        };

        dbContext.Employees.Add(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, MapToResponse(employee));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> Update(
        Guid id,
        [FromBody] EmployeeUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var requiredFieldError = ValidateRequiredEmployeeFields(
            request.DepartmentId,
            request.Department,
            request.DesignationId,
            request.Designation,
            request.Gender,
            request.DateOfBirth);
        if (requiredFieldError is not null)
        {
            return BadRequest(requiredFieldError);
        }

        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        if (request.EmployeeCode != employee.EmployeeCode)
        {
            return BadRequest("Employee code cannot be updated.");
        }

        var departmentResolutionResult = await ResolveOrCreateDepartmentAsync(
            dbContext,
            request.DepartmentId,
            request.Department,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(departmentResolutionResult.Error))
        {
            return BadRequest(departmentResolutionResult.Error);
        }

        var departmentResolution = departmentResolutionResult.Value;
        if (departmentResolution is null)
        {
            return BadRequest("Department is required.");
        }

        var designationResolutionResult = await ResolveOrCreateDesignationAsync(
            dbContext,
            request.DesignationId,
            request.Designation,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(designationResolutionResult.Error))
        {
            return BadRequest(designationResolutionResult.Error);
        }

        var designationResolution = designationResolutionResult.Value;
        if (designationResolution is null)
        {
            return BadRequest("Designation is required.");
        }

        var shiftResolutionResult = await ResolveOrCreateShiftAsync(
            dbContext,
            request.ShiftId,
            request.WorkingTime,
            createIfMissingByName: true,
            cancellationToken);
        if (!string.IsNullOrWhiteSpace(shiftResolutionResult.Error))
        {
            return BadRequest(shiftResolutionResult.Error);
        }

        var shiftResolution = shiftResolutionResult.Value;

        employee.FullName = request.FullName.Trim();
        employee.Email = request.Email?.Trim();
        employee.Phone = request.Phone.Trim();
        employee.DepartmentId = departmentResolution.Id;
        employee.Department = departmentResolution.Name;
        employee.DesignationId = designationResolution.Id;
        employee.Designation = designationResolution.Name;
        employee.Address = request.Address?.Trim();
        employee.FatherName = request.FatherName?.Trim();
        employee.MotherName = request.MotherName?.Trim();
        employee.SpouseName = request.SpouseName?.Trim();
        employee.FatherPhone = request.FatherPhone?.Trim();
        employee.MotherPhone = request.MotherPhone?.Trim();
        employee.SpousePhone = request.SpousePhone?.Trim();
        employee.Gender = request.Gender.Trim();
        employee.Religion = request.Religion?.Trim();
        employee.MaritalStatus = request.MaritalStatus?.Trim();
        employee.BloodGroup = request.BloodGroup?.Trim();
        employee.NationalId = request.NationalId?.Trim();
        employee.EmploymentStatus = request.EmploymentStatus.Trim();
        employee.Photo = request.PhotoBase64 != null ? FromBase64(request.PhotoBase64) : employee.Photo;
        employee.Signature = request.SignatureBase64 != null ? FromBase64(request.SignatureBase64) : employee.Signature;
        employee.ShiftId = shiftResolution?.Id;
        employee.WorkingTime = shiftResolution?.DisplayName;
        employee.SalaryRule = request.SalaryRule?.Trim();
        employee.GrossSalary = request.GrossSalary;
        employee.BasicSalary = request.BasicSalary;
        employee.Weekend = request.Weekend?.Trim();
        employee.SalaryAccount = request.SalaryAccount?.Trim();
        employee.DateOfBirth = request.DateOfBirth;
        employee.JoiningDate = request.JoiningDate;
        employee.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    private static string? ValidateRequiredEmployeeFields(
        Guid? departmentId,
        string? department,
        Guid? designationId,
        string? designation,
        string gender,
        DateOnly? dateOfBirth)
    {
        if (!departmentId.HasValue && string.IsNullOrWhiteSpace(department))
        {
            return "Department is required.";
        }

        if (!designationId.HasValue && string.IsNullOrWhiteSpace(designation))
        {
            return "Designation is required.";
        }

        if (string.IsNullOrWhiteSpace(gender))
        {
            return "Gender is required.";
        }

        if (!dateOfBirth.HasValue)
        {
            return "Date of birth is required.";
        }

        return null;
    }

    [HttpPut("{id:guid}/attributes")]
    public async Task<ActionResult<EmployeeResponse>> ReplaceDynamicAttributes(
        Guid id,
        [FromBody] ReplaceDynamicAttributesRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        employee.DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys);
        employee.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpPut("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<EmployeeResponse>> UpsertDynamicAttribute(
        Guid id,
        string key,
        [FromBody] DynamicAttributeUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var normalizedKey = key.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return BadRequest("Attribute key is required.");
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        var canonicalKey = FindCanonicalKey(normalizedKey, existingKeys.Keys) ?? normalizedKey;
        var updatedAttributes = new Dictionary<string, string?>(employee.DynamicAttributes, StringComparer.OrdinalIgnoreCase)
        {
            [canonicalKey] = request.Value
        };

        employee.DynamicAttributes = updatedAttributes;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpDelete("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<EmployeeResponse>> DeleteDynamicAttribute(
        Guid id,
        string key,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var normalizedKey = key.Trim();
        var updatedAttributes = new Dictionary<string, string?>(employee.DynamicAttributes, StringComparer.OrdinalIgnoreCase);
        if (!updatedAttributes.Remove(normalizedKey))
        {
            return NotFound($"Attribute '{normalizedKey}' not found.");
        }

        employee.DynamicAttributes = updatedAttributes;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        dbContext.Employees.Remove(employee);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    public async Task ProcessCsvImportJobAsync(Guid jobId, string tempFilePath)
    {
        if (IsCsvJobCancellationRequested(jobId))
        {
            UpdateCsvJob(jobId, status =>
            {
                status.Status = "Canceled";
                status.Message = "CSV import canceled before processing started.";
                status.CompletedAtUtc = DateTime.UtcNow;
                status.UpdatedAtUtc = DateTime.UtcNow;
                status.ProgressPercent ??= 0;
            });
            return;
        }

        UpdateCsvJob(jobId, status =>
        {
            status.Status = "Running";
            status.Message = "CSV import is running.";
            status.ProgressPercent = status.ProgressPercent ?? 0;
            status.StartedAtUtc = DateTime.UtcNow;
            status.UpdatedAtUtc = DateTime.UtcNow;
        });

        try
        {
            var content = await System.IO.File.ReadAllTextAsync(tempFilePath, Encoding.UTF8);
            using var scope = scopeFactory.CreateScope();
            var scopedDbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var result = await ProcessCsvUpdateContentAsync(
                content,
                scopedDbContext,
                CancellationToken.None,
                (processedRows, totalRows) =>
                {
                    if (IsCsvJobCancellationRequested(jobId))
                    {
                        return false;
                    }

                    UpdateCsvJob(jobId, status =>
                    {
                        status.TotalRows = totalRows;
                        status.ProcessedRows = processedRows;
                        status.ProgressPercent = totalRows > 0
                            ? Math.Min(100, (int)Math.Round((processedRows / (double)totalRows) * 100))
                            : 100;
                        status.UpdatedAtUtc = DateTime.UtcNow;
                    });
                    return true;
                });

            UpdateCsvJob(jobId, status =>
            {
                status.Status = "Completed";
                status.Message = result.Message;
                status.Result = result;
                status.TotalRows = result.TotalRows;
                status.ProcessedRows = result.TotalRows;
                status.ProgressPercent = 100;
                status.CompletedAtUtc = DateTime.UtcNow;
                status.UpdatedAtUtc = DateTime.UtcNow;
            });
        }
        catch (OperationCanceledException)
        {
            UpdateCsvJob(jobId, status =>
            {
                status.Status = "Canceled";
                status.Message = "CSV import canceled by user.";
                status.CompletedAtUtc = DateTime.UtcNow;
                status.UpdatedAtUtc = DateTime.UtcNow;
                status.Result = new BulkEmployeeCsvUpdateResponse
                {
                    Message = "CSV import canceled by user.",
                    TotalRows = status.TotalRows ?? 0,
                    FailedCount = 0
                };
            });
        }
        catch (CsvValidationException ex)
        {
            var result = new BulkEmployeeCsvUpdateResponse
            {
                Message = ex.Message,
                Errors = ex.Errors.ToList()
            };

            UpdateCsvJob(jobId, status =>
            {
                status.Status = "Failed";
                status.Message = ex.Message;
                status.Result = result;
                status.ProgressPercent ??= 0;
                status.CompletedAtUtc = DateTime.UtcNow;
                status.UpdatedAtUtc = DateTime.UtcNow;
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled CSV background import failure for job {JobId}", jobId);
            var result = new BulkEmployeeCsvUpdateResponse
            {
                Message = "CSV background import failed unexpectedly.",
                Errors = ["Unexpected server error occurred while processing CSV."]
            };

            UpdateCsvJob(jobId, status =>
            {
                status.Status = "Failed";
                status.Message = result.Message;
                status.Result = result;
                status.ProgressPercent ??= 0;
                status.CompletedAtUtc = DateTime.UtcNow;
                status.UpdatedAtUtc = DateTime.UtcNow;
            });
        }
        finally
        {
            try
            {
                if (System.IO.File.Exists(tempFilePath))
                {
                    System.IO.File.Delete(tempFilePath);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to delete temp CSV file {Path} for job {JobId}", tempFilePath, jobId);
            }
        }
    }

    private static bool IsCsvJobCancellationRequested(Guid jobId)
    {
        return CsvImportJobs.TryGetValue(jobId, out var status) && status.CancellationRequested;
    }

    private static void UpdateCsvJob(Guid jobId, Action<BulkEmployeeCsvJobStatusResponse> update)
    {
        CsvImportJobs.AddOrUpdate(
            jobId,
            _ =>
            {
                var status = new BulkEmployeeCsvJobStatusResponse
                {
                    JobId = jobId,
                    Status = "Queued",
                    Message = "CSV import is queued.",
                    ProgressPercent = 0,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                update(status);
                return status;
            },
            (_, existing) =>
            {
                update(existing);
                return existing;
            });
    }

    private static void PruneOldCsvJobs()
    {
        var threshold = DateTime.UtcNow.AddHours(-12);
        var expired = CsvImportJobs
            .Where(x => x.Value.UpdatedAtUtc < threshold)
            .Select(x => x.Key)
            .ToArray();

        foreach (var key in expired)
        {
            CsvImportJobs.TryRemove(key, out _);
        }
    }

    private static async Task<string> SaveCsvContentToTempFileAsync(Guid jobId, string content, CancellationToken cancellationToken)
    {
        var root = Path.Combine(Path.GetTempPath(), "sds-payroll-csv-jobs");
        Directory.CreateDirectory(root);
        var filePath = Path.Combine(root, $"{jobId:N}.csv");
        await System.IO.File.WriteAllTextAsync(filePath, content, Encoding.UTF8, cancellationToken);
        return filePath;
    }

    private static async Task<CsvUploadValidationResult> ReadAndValidateCsvUploadAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return CsvUploadValidationResult.Fail(new BulkEmployeeCsvUpdateResponse
            {
                Message = "CSV upload failed.",
                Errors = ["Please upload a non-empty CSV file."]
            });
        }

        var extension = Path.GetExtension(file.FileName);
        if (!string.Equals(extension, ".csv", StringComparison.OrdinalIgnoreCase))
        {
            return CsvUploadValidationResult.Fail(new BulkEmployeeCsvUpdateResponse
            {
                Message = "CSV upload failed.",
                Errors = ["Only CSV files are supported."]
            });
        }

        string content;
        await using (var stream = file.OpenReadStream())
        using (var reader = new StreamReader(stream, Encoding.UTF8, true))
        {
            content = await reader.ReadToEndAsync(cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            return CsvUploadValidationResult.Fail(new BulkEmployeeCsvUpdateResponse
            {
                Message = "CSV upload failed.",
                Errors = ["CSV file is empty."]
            });
        }

        return CsvUploadValidationResult.Success(content);
    }

    private static async Task<BulkEmployeeCsvUpdateResponse> ProcessCsvUpdateContentAsync(
        string content,
        AppDbContext context,
        CancellationToken cancellationToken,
        Func<int, int, bool>? progressCallback = null)
    {
        List<List<string>> rows;
        try
        {
            rows = ParseCsv(content);
        }
        catch (FormatException ex)
        {
            throw new CsvValidationException("CSV parsing failed.", [ex.Message]);
        }

        if (rows.Count < 2)
        {
            throw new CsvValidationException("CSV validation failed.", ["CSV must contain a header row and at least one data row."]);
        }

        var headers = rows[0].Select(x => x.Trim()).ToArray();
        var headerIndexes = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Length; i++)
        {
            var header = headers[i];
            if (string.IsNullOrWhiteSpace(header))
            {
                continue;
            }

            if (!headerIndexes.TryAdd(header, i))
            {
                throw new CsvValidationException("CSV validation failed.", [$"Duplicate CSV header '{header}'."]);
            }
        }

        if (!headerIndexes.ContainsKey("EmployeeCode"))
        {
            throw new CsvValidationException("CSV validation failed.", ["CSV must include an 'EmployeeCode' column."]);
        }

        var missingCoreHeaders = new[] { "FullName", "Phone", "Department", "Designation", "Gender", "EmploymentStatus", "DateOfBirth", "JoiningDate" }
            .Where(header => !headerIndexes.ContainsKey(header))
            .ToArray();

        if (missingCoreHeaders.Length > 0)
        {
            throw new CsvValidationException(
                "CSV validation failed.",
                [
                    "This file does not look like the exported employee CSV template.",
                    $"Missing required column(s): {string.Join(", ", missingCoreHeaders)}."
                ]);
        }

        var dynamicHeaders = headerIndexes.Keys
            .Where(x => !CsvStaticHeaders.Contains(x, StringComparer.OrdinalIgnoreCase))
            .ToArray();

        var errors = new List<string>();
        var importedCodes = new HashSet<long>();
        var duplicateCodes = new HashSet<long>();
        var parsedCodesByRow = new Dictionary<int, long>();
        var invalidStructureRows = new HashSet<int>();

        var totalDataRows = rows.Skip(1).Count(row => !IsRowEmpty(row));
        var processedRows = 0;

        void MarkProgress()
        {
            processedRows++;
            if (progressCallback is not null && !progressCallback(processedRows, totalDataRows))
            {
                throw new OperationCanceledException("CSV processing canceled.");
            }
        }

        for (var rowIndex = 1; rowIndex < rows.Count; rowIndex++)
        {
            var row = rows[rowIndex];
            if (IsRowEmpty(row))
            {
                continue;
            }

            if (row.Count != headers.Length)
            {
                errors.Add($"Row {rowIndex + 1}: column count mismatch. Expected {headers.Length}, found {row.Count}.");
                invalidStructureRows.Add(rowIndex);
                continue;
            }

            var codeText = GetCellValue(row, headerIndexes, "EmployeeCode");
            if (!TryParseEmployeeCode(codeText, out var code))
            {
                errors.Add($"Row {rowIndex + 1}: invalid EmployeeCode '{codeText}'.");
                continue;
            }

            if (!importedCodes.Add(code))
            {
                duplicateCodes.Add(code);
            }

            parsedCodesByRow[rowIndex] = code;
        }

        foreach (var duplicateCode in duplicateCodes.OrderBy(x => x))
        {
            errors.Add($"EmployeeCode '{duplicateCode}' is duplicated in CSV.");
        }

        var uniqueCodes = parsedCodesByRow
            .Where(x => !duplicateCodes.Contains(x.Value))
            .Select(x => x.Value)
            .Distinct()
            .ToArray();

        var employeesByCode = await context.Employees
            .Where(x => uniqueCodes.Contains(x.EmployeeCode))
            .ToDictionaryAsync(x => x.EmployeeCode, cancellationToken);

        var existingDynamicKeys = await GetDynamicAttributeKeyCounts(context, cancellationToken);
        var lookupCache = await BuildLookupCacheAsync(context, cancellationToken);
        var updatedCount = 0;
        var createdCount = 0;
        var failedCount = 0;

        for (var rowIndex = 1; rowIndex < rows.Count; rowIndex++)
        {
            var row = rows[rowIndex];
            if (IsRowEmpty(row))
            {
                continue;
            }

            if (invalidStructureRows.Contains(rowIndex))
            {
                failedCount++;
                MarkProgress();
                continue;
            }

            if (!parsedCodesByRow.TryGetValue(rowIndex, out var code) || duplicateCodes.Contains(code))
            {
                failedCount++;
                MarkProgress();
                continue;
            }

            var isNewEmployee = !employeesByCode.TryGetValue(code, out var employee);
            employee ??= new Employee
            {
                Id = Guid.NewGuid(),
                EmployeeCode = code,
                FullName = string.Empty,
                Phone = string.Empty,
                EmploymentStatus = string.Empty
            };

            var rowErrorsBefore = errors.Count;
            var fullName = GetRequiredString(row, headerIndexes, "FullName", rowIndex, employee.FullName, errors);
            var phone = GetRequiredString(row, headerIndexes, "Phone", rowIndex, employee.Phone, errors);
            var department = GetRequiredString(row, headerIndexes, "Department", rowIndex, employee.Department ?? string.Empty, errors);
            var designation = GetRequiredString(row, headerIndexes, "Designation", rowIndex, employee.Designation ?? string.Empty, errors);
            var gender = GetRequiredString(row, headerIndexes, "Gender", rowIndex, employee.Gender ?? string.Empty, errors);
            var employmentStatus = GetRequiredString(row, headerIndexes, "EmploymentStatus", rowIndex, employee.EmploymentStatus, errors);
            var dateOfBirth = ParseRequiredDateOnly(row, headerIndexes, "DateOfBirth", rowIndex, employee.DateOfBirth, errors);
            var joiningDate = ParseRequiredDateOnly(row, headerIndexes, "JoiningDate", rowIndex, employee.JoiningDate, errors);
            var grossSalary = ParseOptionalDecimal(row, headerIndexes, "GrossSalary", rowIndex, employee.GrossSalary, errors);
            var basicSalary = ParseOptionalDecimal(row, headerIndexes, "BasicSalary", rowIndex, employee.BasicSalary, errors);

            if (fullName is null ||
                phone is null ||
                department is null ||
                designation is null ||
                gender is null ||
                employmentStatus is null ||
                dateOfBirth is null ||
                joiningDate is null)
            {
                failedCount++;
                MarkProgress();
                continue;
            }

            if (errors.Count > rowErrorsBefore)
            {
                failedCount++;
                MarkProgress();
                continue;
            }

            var departmentResolution = await ResolveOrCreateDepartmentAsync(
                context,
                null,
                department,
                createIfMissingByName: true,
                cancellationToken,
                lookupCache);
            if (departmentResolution.Value is null)
            {
                errors.Add(departmentResolution.Error ?? $"Row {rowIndex + 1}: Department '{department}' is invalid.");
                failedCount++;
                MarkProgress();
                continue;
            }

            var designationResolution = await ResolveOrCreateDesignationAsync(
                context,
                null,
                designation,
                createIfMissingByName: true,
                cancellationToken,
                lookupCache);
            if (designationResolution.Value is null)
            {
                errors.Add(designationResolution.Error ?? $"Row {rowIndex + 1}: Designation '{designation}' is invalid.");
                failedCount++;
                MarkProgress();
                continue;
            }

            var workingTimeValue = GetOptionalString(row, headerIndexes, "WorkingTime", employee.WorkingTime);
            var shiftResolution = await ResolveOrCreateShiftAsync(
                context,
                null,
                workingTimeValue,
                createIfMissingByName: true,
                cancellationToken,
                lookupCache);
            if (!string.IsNullOrWhiteSpace(workingTimeValue) && shiftResolution.Value is null)
            {
                errors.Add(shiftResolution.Error ?? $"Row {rowIndex + 1}: WorkingTime '{workingTimeValue}' is invalid.");
                failedCount++;
                MarkProgress();
                continue;
            }

            employee.FullName = fullName;
            employee.Phone = phone;
            employee.DepartmentId = departmentResolution.Value.Id;
            employee.Department = departmentResolution.Value.Name;
            employee.DesignationId = designationResolution.Value.Id;
            employee.Designation = designationResolution.Value.Name;
            employee.Gender = gender;
            employee.EmploymentStatus = employmentStatus;
            employee.DateOfBirth = dateOfBirth;
            employee.JoiningDate = joiningDate.Value;
            employee.Email = GetOptionalString(row, headerIndexes, "Email", employee.Email);
            employee.Address = GetOptionalString(row, headerIndexes, "Address", employee.Address);
            employee.FatherName = GetOptionalString(row, headerIndexes, "FatherName", employee.FatherName);
            employee.MotherName = GetOptionalString(row, headerIndexes, "MotherName", employee.MotherName);
            employee.SpouseName = GetOptionalString(row, headerIndexes, "SpouseName", employee.SpouseName);
            employee.FatherPhone = GetOptionalString(row, headerIndexes, "FatherPhone", employee.FatherPhone);
            employee.MotherPhone = GetOptionalString(row, headerIndexes, "MotherPhone", employee.MotherPhone);
            employee.SpousePhone = GetOptionalString(row, headerIndexes, "SpousePhone", employee.SpousePhone);
            employee.Religion = GetOptionalString(row, headerIndexes, "Religion", employee.Religion);
            employee.MaritalStatus = GetOptionalString(row, headerIndexes, "MaritalStatus", employee.MaritalStatus);
            employee.BloodGroup = GetOptionalString(row, headerIndexes, "BloodGroup", employee.BloodGroup);
            employee.NationalId = GetOptionalString(row, headerIndexes, "NationalId", employee.NationalId);
            employee.ShiftId = shiftResolution.Value?.Id;
            employee.WorkingTime = shiftResolution.Value?.DisplayName;
            employee.SalaryRule = GetOptionalString(row, headerIndexes, "SalaryRule", employee.SalaryRule);
            employee.GrossSalary = grossSalary;
            employee.BasicSalary = basicSalary;
            employee.Weekend = GetOptionalString(row, headerIndexes, "Weekend", employee.Weekend);
            employee.SalaryAccount = GetOptionalString(row, headerIndexes, "SalaryAccount", employee.SalaryAccount);

            if (dynamicHeaders.Length > 0)
            {
                var dynamicAttributes = new Dictionary<string, string?>(employee.DynamicAttributes, StringComparer.OrdinalIgnoreCase);
                foreach (var dynamicHeader in dynamicHeaders)
                {
                    var value = GetCellValue(row, headerIndexes, dynamicHeader);
                    dynamicAttributes[dynamicHeader] = string.IsNullOrWhiteSpace(value) ? null : value;
                }

                employee.DynamicAttributes = CanonicalizeDynamicAttributes(
                    dynamicAttributes,
                    existingDynamicKeys.Keys.Concat(dynamicHeaders));
            }

            employee.UpdatedAtUtc = DateTime.UtcNow;
            if (isNewEmployee)
            {
                context.Employees.Add(employee);
                employeesByCode[code] = employee;
                createdCount++;
            }
            else
            {
                updatedCount++;
            }
            MarkProgress();
        }

        if (updatedCount > 0 || createdCount > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
        }

        var summaryMessage = errors.Count == 0
            ? $"CSV processing completed. Created {createdCount}, updated {updatedCount}, total {totalDataRows} row(s)."
            : $"CSV processing completed with validation errors. Created {createdCount}, updated {updatedCount}, failed {failedCount}, total {totalDataRows} row(s).";

        return new BulkEmployeeCsvUpdateResponse
        {
            Message = summaryMessage,
            TotalRows = totalDataRows,
            CreatedCount = createdCount,
            UpdatedCount = updatedCount,
            FailedCount = failedCount,
            Errors = errors
        };
    }

    private async Task<Dictionary<string, int>> GetDynamicAttributeKeyCounts(CancellationToken cancellationToken)
    {
        return await GetDynamicAttributeKeyCounts(dbContext, cancellationToken);
    }

    private static async Task<Dictionary<string, int>> GetDynamicAttributeKeyCounts(
        AppDbContext context,
        CancellationToken cancellationToken)
    {
        var allDynamicAttributes = await context.Employees
            .AsNoTracking()
            .Select(x => x.DynamicAttributes)
            .ToListAsync(cancellationToken);

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var attributes in allDynamicAttributes)
        {
            foreach (var key in attributes.Keys)
            {
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                counts.TryGetValue(key, out var current);
                counts[key] = current + 1;
            }
        }

        return counts;
    }

    private sealed class LookupResolution
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = string.Empty;
    }

    private sealed class ShiftResolution
    {
        public Guid Id { get; init; }
        public string DisplayName { get; init; } = string.Empty;
    }

    private sealed class LookupCache
    {
        public Dictionary<string, Department> DepartmentsByName { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, Designation> DesignationsByName { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<Guid, Shift> ShiftsById { get; init; } = new();
        public Dictionary<string, Shift> ShiftsByNameOrDisplay { get; init; } = new(StringComparer.OrdinalIgnoreCase);
    }

    private static string NormalizeLookupText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();

    private static string BuildShiftDisplayNameForEmployee(Shift shift)
    {
        if (!shift.InTime.HasValue || !shift.OutTime.HasValue)
        {
            return shift.Name;
        }

        var start = DateTime.Today.Add(shift.InTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        var end = DateTime.Today.Add(shift.OutTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        return $"{shift.Name} - {start} : {end}";
    }

    private static string ExtractShiftNameCandidate(string shiftValue)
    {
        var parts = shiftValue.Split(" - ", 2, StringSplitOptions.TrimEntries);
        if (parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]))
        {
            return parts[0];
        }

        return shiftValue;
    }

    private static async Task<LookupCache> BuildLookupCacheAsync(AppDbContext context, CancellationToken cancellationToken)
    {
        var departments = await context.Departments.ToListAsync(cancellationToken);
        var designations = await context.Designations.ToListAsync(cancellationToken);
        var shifts = await context.Shifts.ToListAsync(cancellationToken);

        var cache = new LookupCache();

        foreach (var department in departments)
        {
            var key = NormalizeLookupText(department.Name);
            if (!string.IsNullOrWhiteSpace(key))
            {
                cache.DepartmentsByName[key] = department;
            }
        }

        foreach (var designation in designations)
        {
            var key = NormalizeLookupText(designation.Name);
            if (!string.IsNullOrWhiteSpace(key))
            {
                cache.DesignationsByName[key] = designation;
            }
        }

        foreach (var shift in shifts)
        {
            cache.ShiftsById[shift.Id] = shift;

            var nameKey = NormalizeLookupText(shift.Name);
            if (!string.IsNullOrWhiteSpace(nameKey))
            {
                cache.ShiftsByNameOrDisplay[nameKey] = shift;
            }

            var displayKey = NormalizeLookupText(BuildShiftDisplayNameForEmployee(shift));
            if (!string.IsNullOrWhiteSpace(displayKey))
            {
                cache.ShiftsByNameOrDisplay[displayKey] = shift;
            }
        }

        return cache;
    }

    private static async Task<(LookupResolution? Value, string? Error)> ResolveOrCreateDepartmentAsync(
        AppDbContext context,
        Guid? departmentId,
        string? departmentName,
        bool createIfMissingByName,
        CancellationToken cancellationToken,
        LookupCache? cache = null)
    {
        if (departmentId.HasValue)
        {
            var department = await context.Departments.FirstOrDefaultAsync(x => x.Id == departmentId.Value, cancellationToken);
            if (department is null)
            {
                return (null, $"Department '{departmentId}' was not found.");
            }

            return (new LookupResolution { Id = department.Id, Name = department.Name }, null);
        }

        var normalized = NormalizeLookupText(departmentName);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return (null, null);
        }

        Department? existing = null;
        if (cache is not null)
        {
            cache.DepartmentsByName.TryGetValue(normalized, out existing);
        }

        existing ??= await context.Departments.FirstOrDefaultAsync(
            x => x.Name.ToLower() == normalized,
            cancellationToken);

        if (existing is not null)
        {
            if (cache is not null)
            {
                cache.DepartmentsByName[normalized] = existing;
            }

            return (new LookupResolution { Id = existing.Id, Name = existing.Name }, null);
        }

        if (!createIfMissingByName)
        {
            return (null, $"Department '{departmentName}' was not found.");
        }

        var created = new Department
        {
            Id = Guid.NewGuid(),
            Name = departmentName!.Trim()
        };
        context.Departments.Add(created);
        if (cache is not null)
        {
            cache.DepartmentsByName[normalized] = created;
        }

        return (new LookupResolution { Id = created.Id, Name = created.Name }, null);
    }

    private static async Task<(LookupResolution? Value, string? Error)> ResolveOrCreateDesignationAsync(
        AppDbContext context,
        Guid? designationId,
        string? designationName,
        bool createIfMissingByName,
        CancellationToken cancellationToken,
        LookupCache? cache = null)
    {
        if (designationId.HasValue)
        {
            var designation = await context.Designations.FirstOrDefaultAsync(x => x.Id == designationId.Value, cancellationToken);
            if (designation is null)
            {
                return (null, $"Designation '{designationId}' was not found.");
            }

            return (new LookupResolution { Id = designation.Id, Name = designation.Name }, null);
        }

        var normalized = NormalizeLookupText(designationName);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return (null, null);
        }

        Designation? existing = null;
        if (cache is not null)
        {
            cache.DesignationsByName.TryGetValue(normalized, out existing);
        }

        existing ??= await context.Designations.FirstOrDefaultAsync(
            x => x.Name.ToLower() == normalized,
            cancellationToken);

        if (existing is not null)
        {
            if (cache is not null)
            {
                cache.DesignationsByName[normalized] = existing;
            }

            return (new LookupResolution { Id = existing.Id, Name = existing.Name }, null);
        }

        if (!createIfMissingByName)
        {
            return (null, $"Designation '{designationName}' was not found.");
        }

        var created = new Designation
        {
            Id = Guid.NewGuid(),
            Name = designationName!.Trim()
        };
        context.Designations.Add(created);
        if (cache is not null)
        {
            cache.DesignationsByName[normalized] = created;
        }

        return (new LookupResolution { Id = created.Id, Name = created.Name }, null);
    }

    private static async Task<(ShiftResolution? Value, string? Error)> ResolveOrCreateShiftAsync(
        AppDbContext context,
        Guid? shiftId,
        string? workingTime,
        bool createIfMissingByName,
        CancellationToken cancellationToken,
        LookupCache? cache = null)
    {
        if (shiftId.HasValue)
        {
            Shift? byId = null;
            if (cache is not null)
            {
                cache.ShiftsById.TryGetValue(shiftId.Value, out byId);
            }

            byId ??= await context.Shifts.FirstOrDefaultAsync(x => x.Id == shiftId.Value, cancellationToken);
            if (byId is null)
            {
                return (null, $"Shift '{shiftId}' was not found.");
            }

            var display = BuildShiftDisplayNameForEmployee(byId);
            return (new ShiftResolution { Id = byId.Id, DisplayName = display }, null);
        }

        var normalized = NormalizeLookupText(workingTime);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return (null, null);
        }

        Shift? existing = null;
        if (cache is not null)
        {
            cache.ShiftsByNameOrDisplay.TryGetValue(normalized, out existing);
        }

        if (existing is null)
        {
            var allShifts = cache?.ShiftsById.Values.ToList()
                ?? await context.Shifts.ToListAsync(cancellationToken);

            existing = allShifts.FirstOrDefault(x =>
                string.Equals(NormalizeLookupText(x.Name), normalized, StringComparison.Ordinal) ||
                string.Equals(NormalizeLookupText(BuildShiftDisplayNameForEmployee(x)), normalized, StringComparison.Ordinal));
        }

        if (existing is not null)
        {
            if (cache is not null)
            {
                cache.ShiftsById[existing.Id] = existing;
                cache.ShiftsByNameOrDisplay[NormalizeLookupText(existing.Name)] = existing;
                cache.ShiftsByNameOrDisplay[NormalizeLookupText(BuildShiftDisplayNameForEmployee(existing))] = existing;
            }

            return (new ShiftResolution { Id = existing.Id, DisplayName = BuildShiftDisplayNameForEmployee(existing) }, null);
        }

        if (!createIfMissingByName)
        {
            return (null, $"Shift '{workingTime}' was not found.");
        }

        var shiftName = ExtractShiftNameCandidate(workingTime!.Trim());
        var normalizedShiftName = NormalizeLookupText(shiftName);
        if (cache is not null && cache.ShiftsByNameOrDisplay.TryGetValue(normalizedShiftName, out var existingByName))
        {
            return (new ShiftResolution { Id = existingByName.Id, DisplayName = BuildShiftDisplayNameForEmployee(existingByName) }, null);
        }

        var created = new Shift
        {
            Id = Guid.NewGuid(),
            Name = shiftName
        };
        context.Shifts.Add(created);

        if (cache is not null)
        {
            cache.ShiftsById[created.Id] = created;
            cache.ShiftsByNameOrDisplay[NormalizeLookupText(created.Name)] = created;
            cache.ShiftsByNameOrDisplay[NormalizeLookupText(BuildShiftDisplayNameForEmployee(created))] = created;
        }

        return (new ShiftResolution { Id = created.Id, DisplayName = BuildShiftDisplayNameForEmployee(created) }, null);
    }

    private static EmployeeResponse MapToResponse(Employee employee) =>
        new()
        {
            Id = employee.Id,
            EmployeeCode = employee.EmployeeCode,
            FullName = employee.FullName,
            Email = employee.Email,
            Phone = employee.Phone,
            DepartmentId = employee.DepartmentId,
            Department = employee.Department,
            DesignationId = employee.DesignationId,
            Designation = employee.Designation,
            Address = employee.Address,
            FatherName = employee.FatherName,
            MotherName = employee.MotherName,
            SpouseName = employee.SpouseName,
            FatherPhone = employee.FatherPhone,
            MotherPhone = employee.MotherPhone,
            SpousePhone = employee.SpousePhone,
            Gender = employee.Gender,
            Religion = employee.Religion,
            MaritalStatus = employee.MaritalStatus,
            BloodGroup = employee.BloodGroup,
            NationalId = employee.NationalId,
            EmploymentStatus = employee.EmploymentStatus,
            PhotoBase64 = ToBase64(employee.Photo),
            SignatureBase64 = ToBase64(employee.Signature),
            ShiftId = employee.ShiftId,
            WorkingTime = employee.WorkingTime,
            SalaryRule = employee.SalaryRule,
            GrossSalary = employee.GrossSalary,
            BasicSalary = employee.BasicSalary,
            Weekend = employee.Weekend,
            SalaryAccount = employee.SalaryAccount,
            DateOfBirth = employee.DateOfBirth,
            JoiningDate = employee.JoiningDate,
            DynamicAttributes = employee.DynamicAttributes,
            CreatedAtUtc = employee.CreatedAtUtc,
            UpdatedAtUtc = employee.UpdatedAtUtc
        };

    private static Dictionary<string, string?> CanonicalizeDynamicAttributes(
        Dictionary<string, string?> source,
        IEnumerable<string> existingKeys)
    {
        var keys = existingKeys.ToArray();
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in source)
        {
            if (string.IsNullOrWhiteSpace(pair.Key))
            {
                continue;
            }

            var rawKey = pair.Key.Trim();
            var canonicalKey = FindCanonicalKey(rawKey, keys) ?? rawKey;
            result[canonicalKey] = pair.Value;
        }

        return result;
    }

    private static string? FindCanonicalKey(string candidate, IEnumerable<string> existingKeys)
    {
        var normalizedCandidate = NormalizeKey(candidate);
        if (string.IsNullOrWhiteSpace(normalizedCandidate))
        {
            return null;
        }

        return existingKeys.FirstOrDefault(existing =>
            NormalizeKey(existing) == normalizedCandidate);
    }

    private static int CalculateSuggestionScore(string normalizedQuery, string normalizedKey)
    {
        if (string.IsNullOrWhiteSpace(normalizedQuery) || string.IsNullOrWhiteSpace(normalizedKey))
        {
            return 0;
        }

        if (normalizedKey == normalizedQuery)
        {
            return 100;
        }

        if (normalizedKey.StartsWith(normalizedQuery, StringComparison.Ordinal))
        {
            return 85;
        }

        if (normalizedKey.Contains(normalizedQuery, StringComparison.Ordinal))
        {
            return 70;
        }

        var distance = LevenshteinDistance(normalizedQuery, normalizedKey);
        if (distance <= 2)
        {
            return 60 - (distance * 10);
        }

        return 0;
    }

    private static string NormalizeKey(string input)
    {
        var chars = input
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray();

        return new string(chars);
    }

    private static int LevenshteinDistance(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;

        var costs = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++)
        {
            costs[j] = j;
        }

        for (var i = 1; i <= a.Length; i++)
        {
            var previousDiagonal = costs[0];
            costs[0] = i;

            for (var j = 1; j <= b.Length; j++)
            {
                var temp = costs[j];
                var substitutionCost = a[i - 1] == b[j - 1] ? 0 : 1;
                costs[j] = Math.Min(
                    Math.Min(costs[j] + 1, costs[j - 1] + 1),
                    previousDiagonal + substitutionCost);
                previousDiagonal = temp;
            }
        }

        return costs[b.Length];
    }

    private static IQueryable<Employee> ApplyEmployeeFilters(
        IQueryable<Employee> query,
        string? search,
        string? department,
        string? designation,
        DateOnly? joiningDateFrom,
        DateOnly? joiningDateTo)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var rawTerm = search.Trim();
            var likeTerm = $"%{rawTerm}%";
            long? searchCode = long.TryParse(rawTerm, out var parsed) ? parsed : null;

            query = query.Where(x =>
                (searchCode != null && x.EmployeeCode == searchCode) ||
                EF.Functions.ILike(x.FullName, likeTerm) ||
                (x.Phone != null && EF.Functions.ILike(x.Phone, rawTerm)));
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            var term = department.Trim();
            query = query.Where(x => x.Department != null && EF.Functions.ILike(x.Department, term));
        }

        if (!string.IsNullOrWhiteSpace(designation))
        {
            var term = designation.Trim();
            query = query.Where(x => x.Designation != null && EF.Functions.ILike(x.Designation, term));
        }

        if (joiningDateFrom.HasValue)
        {
            query = query.Where(x => x.JoiningDate >= joiningDateFrom.Value);
        }

        if (joiningDateTo.HasValue)
        {
            query = query.Where(x => x.JoiningDate <= joiningDateTo.Value);
        }

        return query;
    }

    private static byte[] BuildCsv(IEnumerable<Employee> employees)
    {
        var employeeList = employees.ToList();
        var dynamicKeys = employeeList
            .SelectMany(x => x.DynamicAttributes.Keys)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var builder = new StringBuilder();
        var allHeaders = CsvStaticHeaders.Concat(dynamicKeys);
        builder.AppendLine(string.Join(",", allHeaders.Select(EscapeCsv)));

        foreach (var employee in employeeList)
        {
            var staticColumns = new[]
            {
                employee.EmployeeCode.ToString(),
                employee.FullName,
                employee.Email ?? string.Empty,
                employee.Phone ?? string.Empty,
                employee.Department ?? string.Empty,
                employee.Designation ?? string.Empty,
                employee.Address ?? string.Empty,
                employee.FatherName ?? string.Empty,
                employee.MotherName ?? string.Empty,
                employee.SpouseName ?? string.Empty,
                employee.FatherPhone ?? string.Empty,
                employee.MotherPhone ?? string.Empty,
                employee.SpousePhone ?? string.Empty,
                employee.Gender ?? string.Empty,
                employee.Religion ?? string.Empty,
                employee.MaritalStatus ?? string.Empty,
                employee.BloodGroup ?? string.Empty,
                employee.NationalId ?? string.Empty,
                employee.EmploymentStatus ?? string.Empty,
                employee.WorkingTime ?? string.Empty,
                employee.SalaryRule ?? string.Empty,
                employee.GrossSalary?.ToString("0.##") ?? string.Empty,
                employee.BasicSalary?.ToString("0.##") ?? string.Empty,
                employee.Weekend ?? string.Empty,
                employee.SalaryAccount ?? string.Empty,
                employee.DateOfBirth?.ToString("yyyy-MM-dd") ?? string.Empty,
                employee.JoiningDate.ToString("yyyy-MM-dd")
            };

            var dynamicValues = dynamicKeys.Select(key =>
                employee.DynamicAttributes.TryGetValue(key, out var value)
                    ? value ?? string.Empty
                    : string.Empty);

            builder.AppendLine(string.Join(",", staticColumns.Concat(dynamicValues).Select(EscapeCsv)));
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static List<List<string>> ParseCsv(string content)
    {
        var rows = new List<List<string>>();
        var currentRow = new List<string>();
        var currentValue = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < content.Length; i++)
        {
            var character = content[i];

            if (inQuotes)
            {
                if (character == '"')
                {
                    if (i + 1 < content.Length && content[i + 1] == '"')
                    {
                        currentValue.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    currentValue.Append(character);
                }

                continue;
            }

            if (character == '"')
            {
                inQuotes = true;
                continue;
            }

            if (character == ',')
            {
                currentRow.Add(currentValue.ToString());
                currentValue.Clear();
                continue;
            }

            if (character == '\r' || character == '\n')
            {
                currentRow.Add(currentValue.ToString());
                currentValue.Clear();
                rows.Add(currentRow);
                currentRow = new List<string>();

                if (character == '\r' && i + 1 < content.Length && content[i + 1] == '\n')
                {
                    i++;
                }

                continue;
            }

            currentValue.Append(character);
        }

        if (inQuotes)
        {
            throw new FormatException("CSV has unmatched quotes.");
        }

        if (currentValue.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentValue.ToString());
            rows.Add(currentRow);
        }

        return rows;
    }

    private static bool IsRowEmpty(IEnumerable<string> row)
    {
        return row.All(string.IsNullOrWhiteSpace);
    }

    private static string GetCellValue(
        IReadOnlyList<string> row,
        IReadOnlyDictionary<string, int> headerIndexes,
        string header)
    {
        if (!headerIndexes.TryGetValue(header, out var index))
        {
            return string.Empty;
        }

        return index < row.Count ? row[index].Trim() : string.Empty;
    }

    private static string? GetRequiredString(
        IReadOnlyList<string> row,
        IReadOnlyDictionary<string, int> headerIndexes,
        string header,
        int rowIndex,
        string currentValue,
        ICollection<string> errors)
    {
        if (!headerIndexes.ContainsKey(header))
        {
            return currentValue;
        }

        var value = GetCellValue(row, headerIndexes, header);
        if (string.IsNullOrWhiteSpace(value))
        {
            if (!string.IsNullOrWhiteSpace(currentValue))
            {
                return currentValue;
            }

            errors.Add($"Row {rowIndex + 1}: '{header}' is required.");
            return null;
        }

        return value;
    }

    private static string? GetOptionalString(
        IReadOnlyList<string> row,
        IReadOnlyDictionary<string, int> headerIndexes,
        string header,
        string? currentValue)
    {
        if (!headerIndexes.ContainsKey(header))
        {
            return currentValue;
        }

        var value = GetCellValue(row, headerIndexes, header);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static decimal? ParseOptionalDecimal(
        IReadOnlyList<string> row,
        IReadOnlyDictionary<string, int> headerIndexes,
        string header,
        int rowIndex,
        decimal? currentValue,
        ICollection<string> errors)
    {
        if (!headerIndexes.ContainsKey(header))
        {
            return currentValue;
        }

        var value = GetCellValue(row, headerIndexes, header);
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var invariantDecimal) ||
            decimal.TryParse(value, NumberStyles.Number, CultureInfo.CurrentCulture, out invariantDecimal))
        {
            return invariantDecimal;
        }

        errors.Add($"Row {rowIndex + 1}: invalid decimal value '{value}' in '{header}'.");
        return currentValue;
    }

    private static DateOnly? ParseRequiredDateOnly(
        IReadOnlyList<string> row,
        IReadOnlyDictionary<string, int> headerIndexes,
        string header,
        int rowIndex,
        DateOnly? currentValue,
        ICollection<string> errors)
    {
        if (!headerIndexes.ContainsKey(header))
        {
            return currentValue;
        }

        var value = GetCellValue(row, headerIndexes, header);
        if (string.IsNullOrWhiteSpace(value))
        {
            if (currentValue.HasValue)
            {
                return currentValue;
            }

            errors.Add($"Row {rowIndex + 1}: '{header}' is required.");
            return null;
        }

        if (TryParseDateOnly(value, out var parsed))
        {
            return parsed;
        }

        errors.Add($"Row {rowIndex + 1}: invalid date '{value}' in '{header}'. Use yyyy-MM-dd.");
        return null;
    }

    private static bool TryParseEmployeeCode(string raw, out long code)
    {
        var value = raw.Trim();
        if (long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out code))
        {
            return true;
        }

        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var decimalCode))
        {
            if (decimalCode >= long.MinValue && decimalCode <= long.MaxValue && decimal.Truncate(decimalCode) == decimalCode)
            {
                code = (long)decimalCode;
                return true;
            }
        }

        code = default;
        return false;
    }

    private static bool TryParseDateOnly(string raw, out DateOnly date)
    {
        var value = raw.Trim();

        var dateFormats = new[]
        {
            "yyyy-MM-dd",
            "M/d/yyyy",
            "MM/dd/yyyy",
            "d/M/yyyy",
            "dd/MM/yyyy",
            "M-d-yyyy",
            "d-M-yyyy"
        };

        if (DateOnly.TryParseExact(value, dateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
        {
            return true;
        }

        if (DateOnly.TryParseExact(value, dateFormats, CultureInfo.CurrentCulture, DateTimeStyles.None, out date))
        {
            return true;
        }

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTime) ||
            DateTime.TryParse(value, CultureInfo.CurrentCulture, DateTimeStyles.None, out dateTime))
        {
            date = DateOnly.FromDateTime(dateTime);
            return true;
        }

        date = default;
        return false;
    }

    private static byte[]? FromBase64(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return null;
        try
        {
            var s = base64;
            if (s.Contains(',')) s = s.Split(',')[1];
            return Convert.FromBase64String(s);
        }
        catch { return null; }
    }

    private static string? ToBase64(byte[]? bytes)
    {
        if (bytes == null || bytes.Length == 0) return null;
        var mimeType = DetectImageMimeType(bytes);
        return $"data:{mimeType};base64,{Convert.ToBase64String(bytes)}";
    }

    private static string DetectImageMimeType(byte[] bytes)
    {
        if (bytes.Length >= 12 &&
            bytes[0] == 0x52 && // R
            bytes[1] == 0x49 && // I
            bytes[2] == 0x46 && // F
            bytes[3] == 0x46 && // F
            bytes[8] == 0x57 && // W
            bytes[9] == 0x45 && // E
            bytes[10] == 0x42 && // B
            bytes[11] == 0x50) // P
        {
            return "image/webp";
        }

        if (bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (bytes.Length >= 8 &&
            bytes[0] == 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4E &&
            bytes[3] == 0x47 &&
            bytes[4] == 0x0D &&
            bytes[5] == 0x0A &&
            bytes[6] == 0x1A &&
            bytes[7] == 0x0A)
        {
            return "image/png";
        }

        if (bytes.Length >= 6 &&
            bytes[0] == 0x47 &&
            bytes[1] == 0x49 &&
            bytes[2] == 0x46 &&
            bytes[3] == 0x38 &&
            (bytes[4] == 0x37 || bytes[4] == 0x39) &&
            bytes[5] == 0x61)
        {
            return "image/gif";
        }

        return "image/webp";
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains('"'))
        {
            value = value.Replace("\"", "\"\"");
        }

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value}\"";
        }

        return value;
    }

    public sealed class BulkEmployeeCsvUpdateResponse
    {
        public string Message { get; set; } = string.Empty;
        public int TotalRows { get; set; }
        public int CreatedCount { get; set; }
        public int UpdatedCount { get; set; }
        public int FailedCount { get; set; }
        public List<string> Errors { get; set; } = [];
    }

    public sealed class BulkEmployeeCsvJobAcceptedResponse
    {
        public Guid JobId { get; set; }
        public string? HangfireJobId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public sealed class BulkEmployeeCsvJobStatusResponse
    {
        public Guid JobId { get; set; }
        public string? HangfireJobId { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool CancellationRequested { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? StartedAtUtc { get; set; }
        public DateTime? CompletedAtUtc { get; set; }
        public DateTime UpdatedAtUtc { get; set; }
        public int? TotalRows { get; set; }
        public int? ProcessedRows { get; set; }
        public int? ProgressPercent { get; set; }
        public BulkEmployeeCsvUpdateResponse? Result { get; set; }
    }

    private sealed class CsvUploadValidationResult
    {
        public bool IsValid { get; private init; }
        public string? Content { get; private init; }
        public BulkEmployeeCsvUpdateResponse? Error { get; private init; }

        public static CsvUploadValidationResult Success(string content) =>
            new()
            {
                IsValid = true,
                Content = content
            };

        public static CsvUploadValidationResult Fail(BulkEmployeeCsvUpdateResponse error) =>
            new()
            {
                IsValid = false,
                Error = error
            };
    }

    private sealed class CsvValidationException(string message, IReadOnlyCollection<string> errors) : Exception(message)
    {
        public IReadOnlyCollection<string> Errors { get; } = errors;
    }
}

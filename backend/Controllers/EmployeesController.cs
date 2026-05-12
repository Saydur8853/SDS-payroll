using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(AppDbContext dbContext) : ControllerBase
{
    private static readonly string[] DefaultEmploymentStatuses = ["Active", "Inactive", "Maternity"];

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
        if (await dbContext.Employees.AnyAsync(x => x.EmployeeCode == request.EmployeeCode, cancellationToken))
        {
            return Conflict($"Employee with code '{request.EmployeeCode}' already exists.");
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = request.EmployeeCode,
            FullName = request.FullName.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone.Trim(),
            Department = request.Department?.Trim(),
            Designation = request.Designation?.Trim(),
            Address = request.Address?.Trim(),
            FatherName = request.FatherName?.Trim(),
            MotherName = request.MotherName?.Trim(),
            SpouseName = request.SpouseName?.Trim(),
            FatherPhone = request.FatherPhone?.Trim(),
            MotherPhone = request.MotherPhone?.Trim(),
            SpousePhone = request.SpousePhone?.Trim(),
            Gender = request.Gender?.Trim(),
            Religion = request.Religion?.Trim(),
            MaritalStatus = request.MaritalStatus?.Trim(),
            BloodGroup = request.BloodGroup?.Trim(),
            NationalId = request.NationalId?.Trim(),
            EmploymentStatus = request.EmploymentStatus.Trim(),
            Photo = FromBase64(request.PhotoBase64),
            Signature = FromBase64(request.SignatureBase64),
            WorkingTime = request.WorkingTime?.Trim(),
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
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        if (await dbContext.Employees.AnyAsync(x => x.Id != id && x.EmployeeCode == request.EmployeeCode, cancellationToken))
        {
            return Conflict($"Employee with code '{request.EmployeeCode}' already exists.");
        }

        employee.EmployeeCode = request.EmployeeCode;
        employee.FullName = request.FullName.Trim();
        employee.Email = request.Email?.Trim();
        employee.Phone = request.Phone.Trim();
        employee.Department = request.Department?.Trim();
        employee.Designation = request.Designation?.Trim();
        employee.Address = request.Address?.Trim();
        employee.FatherName = request.FatherName?.Trim();
        employee.MotherName = request.MotherName?.Trim();
        employee.SpouseName = request.SpouseName?.Trim();
        employee.FatherPhone = request.FatherPhone?.Trim();
        employee.MotherPhone = request.MotherPhone?.Trim();
        employee.SpousePhone = request.SpousePhone?.Trim();
        employee.Gender = request.Gender?.Trim();
        employee.Religion = request.Religion?.Trim();
        employee.MaritalStatus = request.MaritalStatus?.Trim();
        employee.BloodGroup = request.BloodGroup?.Trim();
        employee.NationalId = request.NationalId?.Trim();
        employee.EmploymentStatus = request.EmploymentStatus.Trim();
        employee.Photo = FromBase64(request.PhotoBase64);
        employee.Signature = FromBase64(request.SignatureBase64);
        employee.Photo = request.PhotoBase64 != null ? FromBase64(request.PhotoBase64) : employee.Photo;
        employee.Signature = request.SignatureBase64 != null ? FromBase64(request.SignatureBase64) : employee.Signature;
        employee.WorkingTime = request.WorkingTime?.Trim();
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

    private async Task<Dictionary<string, int>> GetDynamicAttributeKeyCounts(CancellationToken cancellationToken)
    {
        var allDynamicAttributes = await dbContext.Employees
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

    private static EmployeeResponse MapToResponse(Employee employee) =>
        new()
        {
            Id = employee.Id,
            EmployeeCode = employee.EmployeeCode,
            FullName = employee.FullName,
            Email = employee.Email,
            Phone = employee.Phone,
            Department = employee.Department,
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
        var staticHeaders = new[]
        {
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
            "PhotoUrl",
            "SignatureUrl",
            "WorkingTime",
            "SalaryRule",
            "GrossSalary",
            "BasicSalary",
            "Weekend",
            "SalaryAccount",
            "DateOfBirth",
            "JoiningDate"
        };
        var allHeaders = staticHeaders.Concat(dynamicKeys);
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
                employee.Photo != null ? "Yes" : "No",
                employee.Signature != null ? "Yes" : "No",
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
        return "data:image/webp;base64," + Convert.ToBase64String(bytes);
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
}

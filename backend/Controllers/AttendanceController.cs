using System.Data;
using System.Data.OleDb;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController(AppDbContext dbContext) : ControllerBase
{
    private const string SourceTypeAtt2000 = "att2000";
    private const string SourceTypeOnspot = "onspot";

    [HttpGet]
    public async Task<ActionResult<PagedResponse<AttendanceRecordResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] long? employeeCode = null,
        [FromQuery] string? sourceType = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        [FromQuery] string? company = null,
        [FromQuery] string? department = null,
        [FromQuery] string? designation = null,
        CancellationToken cancellationToken = default)
    {
        if (fromDate.HasValue && toDate.HasValue && fromDate > toDate)
        {
            return BadRequest("fromDate cannot be later than toDate.");
        }

        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 10, 200);

        var recordsQuery = dbContext.AttendanceRecords.AsNoTracking().AsQueryable();

        if (employeeCode.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.EmployeeCode == employeeCode.Value);
        }

        if (fromDate.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.AttendanceDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.AttendanceDate <= toDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(sourceType))
        {
            var normalizedSource = sourceType.Trim().ToLowerInvariant();
            recordsQuery = recordsQuery.Where(x => x.SourceType.ToLower() == normalizedSource);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var token = search.Trim().ToLower();
            recordsQuery = recordsQuery.Where(x =>
                x.SourceFileName.ToLower().Contains(token) ||
                (x.DeviceEmployeeCode != null && x.DeviceEmployeeCode.ToLower().Contains(token)) ||
                x.EmployeeCode.ToString().Contains(token));
        }

        var employeeLookupQuery = dbContext.Employees.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(company))
        {
            var token = company.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Company != null && x.Company.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            var token = department.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Department != null && x.Department.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(designation))
        {
            var token = designation.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Designation != null && x.Designation.ToLower().Contains(token));
        }

        var query =
            from record in recordsQuery
            join employee in employeeLookupQuery on record.EmployeeCode equals employee.EmployeeCode into employeeJoin
            from employee in employeeJoin.DefaultIfEmpty()
            select new { record, employee };

        if (!string.IsNullOrWhiteSpace(company) || !string.IsNullOrWhiteSpace(department) || !string.IsNullOrWhiteSpace(designation))
        {
            query = query.Where(x => x.employee != null);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)safePageSize);

        var items = await query
            .OrderByDescending(x => x.record.PunchTime)
            .ThenBy(x => x.record.EmployeeCode)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AttendanceRecordResponse
            {
                Id = x.record.Id,
                EmployeeCode = x.record.EmployeeCode,
                EmployeeName = x.employee != null ? x.employee.FullName : null,
                Company = x.employee != null ? x.employee.Company : null,
                Department = x.employee != null ? x.employee.Department : null,
                Designation = x.employee != null ? x.employee.Designation : null,
                PunchTime = x.record.PunchTime,
                AttendanceDate = x.record.AttendanceDate,
                SourceType = x.record.SourceType,
                SourceFileName = x.record.SourceFileName,
                DeviceEmployeeCode = x.record.DeviceEmployeeCode,
                Remarks = x.record.Remarks,
                CreatedAtUtc = x.record.CreatedAtUtc,
                UpdatedAtUtc = x.record.UpdatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AttendanceRecordResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = safePage,
            PageSize = safePageSize,
            TotalPages = totalPages
        });
    }

    [HttpGet("details")]
    public async Task<ActionResult<PagedResponse<AttendanceDailyDetailResponse>>> GetDetails(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] long? employeeCode = null,
        [FromQuery] string? sourceType = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        [FromQuery] string? company = null,
        [FromQuery] string? department = null,
        [FromQuery] string? designation = null,
        CancellationToken cancellationToken = default)
    {
        if (fromDate.HasValue && toDate.HasValue && fromDate > toDate)
        {
            return BadRequest("fromDate cannot be later than toDate.");
        }

        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 10, 200);

        var recordsQuery = dbContext.AttendanceRecords.AsNoTracking().AsQueryable();

        if (employeeCode.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.EmployeeCode == employeeCode.Value);
        }

        if (fromDate.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.AttendanceDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            recordsQuery = recordsQuery.Where(x => x.AttendanceDate <= toDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(sourceType))
        {
            var normalizedSource = sourceType.Trim().ToLowerInvariant();
            recordsQuery = recordsQuery.Where(x => x.SourceType.ToLower() == normalizedSource);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var token = search.Trim().ToLower();
            recordsQuery = recordsQuery.Where(x =>
                x.SourceFileName.ToLower().Contains(token) ||
                (x.DeviceEmployeeCode != null && x.DeviceEmployeeCode.ToLower().Contains(token)) ||
                x.EmployeeCode.ToString().Contains(token));
        }

        var employeeLookupQuery = dbContext.Employees.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(company))
        {
            var token = company.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Company != null && x.Company.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            var token = department.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Department != null && x.Department.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(designation))
        {
            var token = designation.Trim().ToLower();
            employeeLookupQuery = employeeLookupQuery.Where(x => x.Designation != null && x.Designation.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(company) || !string.IsNullOrWhiteSpace(department) || !string.IsNullOrWhiteSpace(designation))
        {
            var allowedCodes = await employeeLookupQuery
                .Select(x => x.EmployeeCode)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (allowedCodes.Count == 0)
            {
                return Ok(new PagedResponse<AttendanceDailyDetailResponse>
                {
                    Items = [],
                    TotalCount = 0,
                    Page = safePage,
                    PageSize = safePageSize,
                    TotalPages = 0
                });
            }

            recordsQuery = recordsQuery.Where(x => allowedCodes.Contains(x.EmployeeCode));
        }

        var detailQuery = recordsQuery
            .GroupBy(x => new { x.EmployeeCode, x.AttendanceDate })
            .Select(x => new AttendanceDailyAggregate
            {
                EmployeeCode = x.Key.EmployeeCode,
                AttendanceDate = x.Key.AttendanceDate,
                InTime = x.Min(y => y.PunchTime),
                OutTime = x.Max(y => y.PunchTime),
                PunchCount = x.Count(),
                SourceType = x.Max(y => y.SourceType),
                SourceFileName = x.Max(y => y.SourceFileName)
            });

        var totalCount = await detailQuery.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)safePageSize);

        var detailRows = await detailQuery
            .OrderByDescending(x => x.AttendanceDate)
            .ThenBy(x => x.EmployeeCode)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);

        if (detailRows.Count == 0)
        {
            return Ok(new PagedResponse<AttendanceDailyDetailResponse>
            {
                Items = [],
                TotalCount = totalCount,
                Page = safePage,
                PageSize = safePageSize,
                TotalPages = totalPages
            });
        }

        var employeeCodes = detailRows.Select(x => x.EmployeeCode).Distinct().ToList();
        var employeeRows = await dbContext.Employees
            .AsNoTracking()
            .Where(x => employeeCodes.Contains(x.EmployeeCode))
            .Select(x => new AttendanceEmployeeLookup
            {
                EmployeeCode = x.EmployeeCode,
                FullName = x.FullName,
                Company = x.Company,
                Department = x.Department,
                Designation = x.Designation,
                ShiftId = x.ShiftId
            })
            .ToListAsync(cancellationToken);

        var employeeMap = employeeRows.ToDictionary(x => x.EmployeeCode);
        var shiftIds = employeeRows
            .Where(x => x.ShiftId.HasValue)
            .Select(x => x.ShiftId!.Value)
            .Distinct()
            .ToList();

        var shiftMap = shiftIds.Count == 0
            ? new Dictionary<Guid, Shift>()
            : await dbContext.Shifts
                .AsNoTracking()
                .Where(x => shiftIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = detailRows.Select(x =>
        {
            employeeMap.TryGetValue(x.EmployeeCode, out var employee);
            Shift? shift = null;
            if (employee?.ShiftId is Guid shiftId && shiftMap.TryGetValue(shiftId, out var shiftValue))
            {
                shift = shiftValue;
            }

            return ToDailyDetailResponse(x, employee, shift);
        }).ToList();

        return Ok(new PagedResponse<AttendanceDailyDetailResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = safePage,
            PageSize = safePageSize,
            TotalPages = totalPages
        });
    }

    [HttpPost("upload-mdb")]
    [RequestSizeLimit(600_000_000)]
    public async Task<ActionResult<AttendanceUploadResultResponse>> UploadMdb(
        [FromForm] AttendanceUploadRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest("MDB file is required.");
        }

        if (request.FromDate is null || request.ToDate is null)
        {
            return BadRequest("From and To date are required.");
        }

        if (request.FromDate > request.ToDate)
        {
            return BadRequest("From date cannot be later than To date.");
        }

        if (!request.File.FileName.EndsWith(".mdb", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only .mdb files are supported.");
        }

        var allowedEmployeeCodes = await ResolveEmployeeCodesAsync(request, cancellationToken);
        if (allowedEmployeeCodes.Count == 0)
        {
            return BadRequest("No matching employees found for the selected filters/date range.");
        }

        var tempFilePath = Path.Combine(Path.GetTempPath(), $"att_upload_{Guid.NewGuid():N}.mdb");
        await using (var stream = System.IO.File.Create(tempFilePath))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        try
        {
            var sourceType = request.SourceType?.Trim().ToLowerInvariant();
            var readResult = ReadPunchRowsFromMdb(
                tempFilePath,
                request.File.FileName,
                sourceType,
                request.FromDate.Value,
                request.ToDate.Value,
                allowedEmployeeCodes);

            int deletedExisting = 0;
            if (request.ReplaceExisting)
            {
                var existingRecords = await dbContext.AttendanceRecords
                    .Where(x => x.AttendanceDate >= request.FromDate.Value && x.AttendanceDate <= request.ToDate.Value)
                    .Where(x => allowedEmployeeCodes.Contains(x.EmployeeCode))
                    .ToListAsync(cancellationToken);

                deletedExisting = existingRecords.Count;
                if (deletedExisting > 0)
                {
                    dbContext.AttendanceRecords.RemoveRange(existingRecords);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
            }

            var existingKeys = request.ReplaceExisting
                ? new HashSet<string>(StringComparer.Ordinal)
                : await dbContext.AttendanceRecords
                    .Where(x => x.AttendanceDate >= request.FromDate.Value && x.AttendanceDate <= request.ToDate.Value)
                    .Where(x => allowedEmployeeCodes.Contains(x.EmployeeCode))
                    .Select(x => $"{x.EmployeeCode}:{x.PunchTime:O}")
                    .ToHashSetAsync(cancellationToken);

            var batchKeys = new HashSet<string>(StringComparer.Ordinal);
            var insertList = new List<AttendanceRecord>(readResult.Punches.Count);
            var duplicateRowsSkipped = 0;
            var invalidRowsSkipped = readResult.InvalidRows;

            foreach (var punch in readResult.Punches)
            {
                if (!allowedEmployeeCodes.Contains(punch.EmployeeCode))
                {
                    invalidRowsSkipped++;
                    continue;
                }

                var normalizedPunchTime = NormalizeToUtc(punch.PunchTime);
                var key = $"{punch.EmployeeCode}:{normalizedPunchTime:O}";
                if (batchKeys.Contains(key) || existingKeys.Contains(key))
                {
                    duplicateRowsSkipped++;
                    continue;
                }

                batchKeys.Add(key);
                insertList.Add(new AttendanceRecord
                {
                    Id = Guid.NewGuid(),
                    EmployeeCode = punch.EmployeeCode,
                    PunchTime = normalizedPunchTime,
                    AttendanceDate = DateOnly.FromDateTime(normalizedPunchTime),
                    SourceType = readResult.SourceType,
                    SourceFileName = Path.GetFileName(request.File.FileName),
                    DeviceEmployeeCode = punch.DeviceEmployeeCode,
                    Remarks = null,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }

            if (insertList.Count > 0)
            {
                dbContext.AttendanceRecords.AddRange(insertList);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Ok(new AttendanceUploadResultResponse
            {
                SourceType = readResult.SourceType,
                FileName = request.File.FileName,
                FromDate = request.FromDate.Value,
                ToDate = request.ToDate.Value,
                AllowedEmployeeCount = allowedEmployeeCodes.Count,
                TotalPunchRowsRead = readResult.TotalRows,
                ExistingRowsDeleted = deletedExisting,
                InsertedRows = insertList.Count,
                DuplicateRowsSkipped = duplicateRowsSkipped,
                InvalidRowsSkipped = invalidRowsSkipped,
                SourceMinPunchTimeUtc = readResult.SourceMinPunchTimeUtc,
                SourceMaxPunchTimeUtc = readResult.SourceMaxPunchTimeUtc
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
            catch
            {
                // Ignore temp file cleanup errors.
            }
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AttendanceRecordResponse>> Update(
        Guid id,
        [FromBody] AttendanceUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var record = await dbContext.AttendanceRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null)
        {
            return NotFound();
        }

        var employeeCode = request.EmployeeCode;
        var punchTime = request.PunchTime;
        if (!employeeCode.HasValue || !punchTime.HasValue)
        {
            return BadRequest("Employee code and punch time are required.");
        }

        var normalizedPunchTime = NormalizeToUtc(punchTime.Value);

        var exists = await dbContext.AttendanceRecords.AnyAsync(
            x => x.Id != id && x.EmployeeCode == employeeCode.Value && x.PunchTime == normalizedPunchTime,
            cancellationToken);
        if (exists)
        {
            return Conflict("A record with the same employee code and punch time already exists.");
        }

        record.EmployeeCode = employeeCode.Value;
        record.PunchTime = normalizedPunchTime;
        record.AttendanceDate = DateOnly.FromDateTime(normalizedPunchTime);
        record.Remarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        record.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.EmployeeCode == record.EmployeeCode, cancellationToken);

        return Ok(ToResponse(record, employee));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var record = await dbContext.AttendanceRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null)
        {
            return NotFound();
        }

        dbContext.AttendanceRecords.Remove(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static AttendanceRecordResponse ToResponse(AttendanceRecord record, Employee? employee) =>
        new()
        {
            Id = record.Id,
            EmployeeCode = record.EmployeeCode,
            EmployeeName = employee?.FullName,
            Company = employee?.Company,
            Department = employee?.Department,
            Designation = employee?.Designation,
            PunchTime = record.PunchTime,
            AttendanceDate = record.AttendanceDate,
            SourceType = record.SourceType,
            SourceFileName = record.SourceFileName,
            DeviceEmployeeCode = record.DeviceEmployeeCode,
            Remarks = record.Remarks,
            CreatedAtUtc = record.CreatedAtUtc,
            UpdatedAtUtc = record.UpdatedAtUtc
        };

    private static AttendanceDailyDetailResponse ToDailyDetailResponse(
        AttendanceDailyAggregate value,
        AttendanceEmployeeLookup? employee,
        Shift? shift)
    {
        var inTimeUtc = NormalizeToUtc(value.InTime);
        var outTimeUtc = value.PunchCount > 1 ? NormalizeToUtc(value.OutTime) : (DateTime?)null;
        var inTimeLocal = ConvertUtcToAssumedPlantLocal(inTimeUtc);
        var outTimeLocal = outTimeUtc.HasValue ? ConvertUtcToAssumedPlantLocal(outTimeUtc.Value) : (DateTime?)null;

        int? workedMinutes = null;
        if (outTimeUtc.HasValue)
        {
            workedMinutes = Math.Max(0, (int)Math.Round((outTimeUtc.Value - inTimeUtc).TotalMinutes));
        }

        var lateMinutes = CalculateLateMinutes(inTimeLocal, value.AttendanceDate, shift);
        var earlyOutMinutes = CalculateEarlyOutMinutes(inTimeLocal, outTimeLocal, value.AttendanceDate, shift);

        return new AttendanceDailyDetailResponse
        {
            EmployeeCode = value.EmployeeCode,
            EmployeeName = employee?.FullName,
            Company = employee?.Company,
            Department = employee?.Department,
            Designation = employee?.Designation,
            AttendanceDate = value.AttendanceDate,
            InTime = inTimeUtc,
            OutTime = outTimeUtc,
            PunchCount = value.PunchCount,
            WorkedMinutes = workedMinutes,
            LateMinutes = lateMinutes,
            EarlyOutMinutes = earlyOutMinutes,
            Status = value.PunchCount > 1 ? "PRESENT" : "IN_ONLY",
            ShiftName = shift?.Name,
            ShiftDisplayName = shift is null ? null : BuildShiftDisplayName(shift.Name, shift.InTime, shift.OutTime),
            SourceType = value.SourceType ?? string.Empty,
            SourceFileName = value.SourceFileName ?? string.Empty
        };
    }

    private static string BuildShiftDisplayName(string name, TimeOnly? inTime, TimeOnly? outTime)
    {
        if (!inTime.HasValue || !outTime.HasValue)
        {
            return name;
        }

        var start = DateTime.Today.Add(inTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        var end = DateTime.Today.Add(outTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        return $"{name} - {start} : {end}";
    }

    private static int? CalculateLateMinutes(DateTime inTimeLocal, DateOnly attendanceDate, Shift? shift)
    {
        if (shift?.InTime is null)
        {
            return null;
        }

        var allowedInTime = shift.InTimeGrace ?? shift.InTime;
        var allowedInDateTime = attendanceDate.ToDateTime(allowedInTime.Value);
        if (inTimeLocal <= allowedInDateTime)
        {
            return 0;
        }

        return (int)Math.Round((inTimeLocal - allowedInDateTime).TotalMinutes);
    }

    private static int? CalculateEarlyOutMinutes(DateTime inTimeLocal, DateTime? outTimeLocal, DateOnly attendanceDate, Shift? shift)
    {
        if (shift?.OutTime is null || !outTimeLocal.HasValue)
        {
            return null;
        }

        var expectedOutTime = shift.OutTimeGrace ?? shift.OutTime;
        var expectedOutDate = attendanceDate;
        if (shift.InTime.HasValue && shift.OutTime.Value <= shift.InTime.Value)
        {
            expectedOutDate = expectedOutDate.AddDays(1);
        }

        var expectedOutDateTime = expectedOutDate.ToDateTime(expectedOutTime.Value);
        var actualOutDateTime = outTimeLocal.Value;
        if (actualOutDateTime < inTimeLocal)
        {
            actualOutDateTime = actualOutDateTime.AddDays(1);
        }

        if (actualOutDateTime >= expectedOutDateTime)
        {
            return 0;
        }

        return (int)Math.Round((expectedOutDateTime - actualOutDateTime).TotalMinutes);
    }

    private async Task<HashSet<long>> ResolveEmployeeCodesAsync(AttendanceUploadRequest request, CancellationToken cancellationToken)
    {
        var query = dbContext.Employees.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Company))
        {
            var token = request.Company.Trim().ToLower();
            query = query.Where(x => x.Company != null && x.Company.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(request.Department))
        {
            var token = request.Department.Trim().ToLower();
            query = query.Where(x => x.Department != null && x.Department.ToLower().Contains(token));
        }

        if (!string.IsNullOrWhiteSpace(request.Designation))
        {
            var token = request.Designation.Trim().ToLower();
            query = query.Where(x => x.Designation != null && x.Designation.ToLower().Contains(token));
        }

        var selectedCodes = ParseEmployeeCodesCsv(request.EmployeeCodesCsv);
        if (selectedCodes.Count > 0)
        {
            query = query.Where(x => selectedCodes.Contains(x.EmployeeCode));
        }

        var codes = await query
            .Select(x => x.EmployeeCode)
            .Distinct()
            .ToListAsync(cancellationToken);

        return codes.ToHashSet();
    }

    private static HashSet<long> ParseEmployeeCodesCsv(string? csv)
    {
        var result = new HashSet<long>();
        if (string.IsNullOrWhiteSpace(csv))
        {
            return result;
        }

        var tokens = csv
            .Split([',', ';', '\n', '\r', '\t', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var token in tokens)
        {
            if (long.TryParse(token, out var code))
            {
                result.Add(code);
            }
        }

        return result;
    }

    private ReadPunchRowsResult ReadPunchRowsFromMdb(
        string mdbPath,
        string fileName,
        string? requestedSourceType,
        DateOnly fromDate,
        DateOnly toDate,
        HashSet<long> allowedEmployeeCodes)
    {
        var providers = new[]
        {
            $"Provider=Microsoft.Jet.OLEDB.4.0;Data Source={mdbPath};",
            $"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={mdbPath};Persist Security Info=False;"
        };

        Exception? lastException = null;
        foreach (var provider in providers)
        {
            try
            {
                using var connection = new OleDbConnection(provider);
                connection.Open();
                var sourceType = ResolveSourceType(connection, fileName, requestedSourceType);
                var sourceRange = GetSourcePunchRange(connection, sourceType);

                var fromDateTime = fromDate.ToDateTime(TimeOnly.MinValue);
                var toExclusive = toDate.AddDays(1).ToDateTime(TimeOnly.MinValue);
                var orderedCodes = allowedEmployeeCodes.OrderBy(x => x).ToList();

                string sql;
                if (sourceType == SourceTypeAtt2000)
                {
                    var employeeFilter = orderedCodes.Count == 0
                        ? string.Empty
                        : $" AND U.BADGENUMBER IN ({string.Join(",", orderedCodes.Select(x => $"'{x}'"))})";

                    sql =
                        "SELECT U.BADGENUMBER AS EmpNo, C.CHECKTIME AS MchData " +
                        "FROM USERINFO U INNER JOIN CHECKINOUT C ON U.USERID = C.USERID " +
                        $"WHERE C.CHECKTIME BETWEEN #{FormatAccessDate(fromDateTime)}# AND #{FormatAccessDate(toExclusive)}#{employeeFilter} " +
                        "ORDER BY C.CHECKTIME, U.BADGENUMBER";
                }
                else
                {
                    var employeeFilter = orderedCodes.Count == 0
                        ? string.Empty
                        : $" AND E.FingerNo IN ({string.Join(",", orderedCodes)})";

                    sql =
                        "SELECT E.FingerNo AS EmpNo, D.KQDatetime AS MchData " +
                        "FROM KQ_KQData D INNER JOIN RS_EmpDynamicInfo E ON D.EmpNo = E.EmpNo " +
                        $"WHERE D.KQDate BETWEEN #{FormatAccessDate(fromDateTime)}# AND #{FormatAccessDate(toExclusive)}#{employeeFilter} " +
                        "ORDER BY D.KQDatetime, E.FingerNo";
                }

                var table = new DataTable();
                using (var adapter = new OleDbDataAdapter(sql, connection))
                {
                    adapter.Fill(table);
                }

                var punches = new List<PunchRow>(table.Rows.Count);
                var invalidRows = 0;

                foreach (DataRow row in table.Rows)
                {
                    var rawTimeValue = row["MchData"];

                    if (!TryParseEmployeeCode(row["EmpNo"], out var employeeCode) ||
                        !TryParsePunchTime(rawTimeValue, out var punchTime))
                    {
                        invalidRows++;
                        continue;
                    }

                    punches.Add(new PunchRow
                    {
                        EmployeeCode = employeeCode,
                        DeviceEmployeeCode = employeeCode.ToString(),
                        PunchTime = punchTime
                    });
                }

                return new ReadPunchRowsResult
                {
                    SourceType = sourceType,
                    TotalRows = table.Rows.Count,
                    InvalidRows = invalidRows,
                    Punches = punches,
                    SourceMinPunchTimeUtc = sourceRange.MinUtc,
                    SourceMaxPunchTimeUtc = sourceRange.MaxUtc
                };
            }
            catch (Exception ex)
            {
                lastException = ex;
            }
        }

        throw new InvalidOperationException(
            "Failed to open/read MDB file. Ensure Microsoft Access Database Engine is installed.",
            lastException);
    }

    private static string ResolveSourceType(OleDbConnection connection, string fileName, string? requestedSourceType)
    {
        if (!string.IsNullOrWhiteSpace(requestedSourceType))
        {
            var normalized = requestedSourceType.Trim().ToLowerInvariant();
            if (normalized == SourceTypeAtt2000 || normalized == SourceTypeOnspot)
            {
                return normalized;
            }

            throw new InvalidOperationException("sourceType must be 'att2000' or 'onspot'.");
        }

        var normalizedName = Path.GetFileNameWithoutExtension(fileName).ToLowerInvariant();
        if (normalizedName.StartsWith("att2000", StringComparison.Ordinal))
        {
            return SourceTypeAtt2000;
        }

        if (normalizedName.StartsWith("onspot", StringComparison.Ordinal) || normalizedName.StartsWith("etimemj", StringComparison.Ordinal))
        {
            return SourceTypeOnspot;
        }

        var tables = GetTableNames(connection);
        if (tables.Contains("USERINFO") && tables.Contains("CHECKINOUT"))
        {
            return SourceTypeAtt2000;
        }

        if (tables.Contains("KQ_KQData") && tables.Contains("RS_EmpDynamicInfo"))
        {
            return SourceTypeOnspot;
        }

        throw new InvalidOperationException("Unsupported MDB format. Use Onspot/att2000 file structure.");
    }

    private static HashSet<string> GetTableNames(OleDbConnection connection)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var schema = connection.GetOleDbSchemaTable(OleDbSchemaGuid.Tables, null);
        if (schema is null)
        {
            return set;
        }

        foreach (DataRow row in schema.Rows)
        {
            var tableType = row["TABLE_TYPE"]?.ToString();
            if (tableType is not "TABLE" and not "VIEW")
            {
                continue;
            }

            var tableName = row["TABLE_NAME"]?.ToString();
            if (!string.IsNullOrWhiteSpace(tableName))
            {
                set.Add(tableName.Trim());
            }
        }

        return set;
    }

    private static string FormatAccessDate(DateTime value) => value.ToString("MM/dd/yyyy HH:mm:ss");

    private static (DateTime? MinUtc, DateTime? MaxUtc) GetSourcePunchRange(OleDbConnection connection, string sourceType)
    {
        var sql = sourceType == SourceTypeAtt2000
            ? "SELECT MIN(CHECKTIME) AS MinDt, MAX(CHECKTIME) AS MaxDt FROM CHECKINOUT"
            : "SELECT MIN(KQDatetime) AS MinDt, MAX(KQDatetime) AS MaxDt FROM KQ_KQData";

        using var command = new OleDbCommand(sql, connection);
        using var reader = command.ExecuteReader();
        if (reader is null || !reader.Read())
        {
            return (null, null);
        }

        DateTime? minUtc = null;
        DateTime? maxUtc = null;

        var minValue = reader["MinDt"];
        var maxValue = reader["MaxDt"];

        if (TryParsePunchTime(minValue, out var minParsed))
        {
            minUtc = minParsed;
        }

        if (TryParsePunchTime(maxValue, out var maxParsed))
        {
            maxUtc = maxParsed;
        }

        return (minUtc, maxUtc);
    }

    private static bool TryParseEmployeeCode(object? rawValue, out long employeeCode)
    {
        employeeCode = 0;
        if (rawValue is null || rawValue == DBNull.Value)
        {
            return false;
        }

        switch (rawValue)
        {
            case byte b:
                employeeCode = b;
                return true;
            case short s:
                employeeCode = s;
                return true;
            case int i:
                employeeCode = i;
                return true;
            case long l:
                employeeCode = l;
                return true;
            case decimal dec:
                employeeCode = decimal.ToInt64(decimal.Truncate(dec));
                return true;
            case double dbl:
                employeeCode = Convert.ToInt64(Math.Truncate(dbl));
                return true;
            case float flt:
                employeeCode = Convert.ToInt64(Math.Truncate(flt));
                return true;
        }

        var text = rawValue.ToString()?.Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        if (long.TryParse(text, out employeeCode))
        {
            return true;
        }

        if (decimal.TryParse(text, out var parsedDecimal))
        {
            employeeCode = decimal.ToInt64(decimal.Truncate(parsedDecimal));
            return true;
        }

        return false;
    }

    private static bool TryParsePunchTime(object? rawValue, out DateTime punchTime)
    {
        punchTime = default;
        if (rawValue is null || rawValue == DBNull.Value)
        {
            return false;
        }

        if (rawValue is DateTime dt)
        {
            punchTime = NormalizeToUtc(dt);
            return true;
        }

        if (!DateTime.TryParse(rawValue.ToString(), out var parsed))
        {
            return false;
        }

        punchTime = NormalizeToUtc(parsed);
        return true;
    }

    private static DateTime NormalizeToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => ConvertAssumedLocalToUtc(value)
        };
    }

    private static DateTime ConvertAssumedLocalToUtc(DateTime value)
    {
        // Device punches are local plant time. Prefer Bangladesh timezone (UTC+6),
        // fallback to server local timezone if timezone ids are unavailable.
        var bangladeshTimeZoneIds = new[] { "Bangladesh Standard Time", "Asia/Dhaka" };
        foreach (var timeZoneId in bangladeshTimeZoneIds)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
                return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), tz);
            }
            catch
            {
                // Try next timezone id.
            }
        }

        return DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
    }

    private static DateTime ConvertUtcToAssumedPlantLocal(DateTime value)
    {
        var utcValue = value.Kind == DateTimeKind.Utc
            ? value
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);

        var bangladeshTimeZoneIds = new[] { "Bangladesh Standard Time", "Asia/Dhaka" };
        foreach (var timeZoneId in bangladeshTimeZoneIds)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
                return TimeZoneInfo.ConvertTimeFromUtc(utcValue, tz);
            }
            catch
            {
                // Try next timezone id.
            }
        }

        return utcValue.ToLocalTime();
    }

    private sealed class PunchRow
    {
        public long EmployeeCode { get; init; }
        public string? DeviceEmployeeCode { get; init; }
        public DateTime PunchTime { get; init; }
    }

    private sealed class ReadPunchRowsResult
    {
        public string SourceType { get; init; } = string.Empty;
        public int TotalRows { get; init; }
        public int InvalidRows { get; init; }
        public List<PunchRow> Punches { get; init; } = [];
        public DateTime? SourceMinPunchTimeUtc { get; init; }
        public DateTime? SourceMaxPunchTimeUtc { get; init; }
    }

    private sealed class AttendanceDailyAggregate
    {
        public long EmployeeCode { get; init; }
        public DateOnly AttendanceDate { get; init; }
        public DateTime InTime { get; init; }
        public DateTime OutTime { get; init; }
        public int PunchCount { get; init; }
        public string? SourceType { get; init; }
        public string? SourceFileName { get; init; }
    }

    private sealed class AttendanceEmployeeLookup
    {
        public long EmployeeCode { get; init; }
        public string FullName { get; init; } = string.Empty;
        public string? Company { get; init; }
        public string? Department { get; init; }
        public string? Designation { get; init; }
        public Guid? ShiftId { get; init; }
    }
}

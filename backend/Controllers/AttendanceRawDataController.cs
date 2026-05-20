using System.Data;
using System.Data.OleDb;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceRawDataController(AppDbContext dbContext) : ControllerBase
{
    private const string SourceTypeAtt2000 = "att2000";
    private const string SourceTypeOnspot = "onspot";

    [HttpGet]
    public async Task<ActionResult<PagedResponse<AttendanceRawDataResponse>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? employeeCode = null,
        [FromQuery] string? sourceType = null,
        [FromQuery] Guid? uploadBatchId = null,
        [FromQuery] DateTime? fromPunchDate = null,
        [FromQuery] DateTime? toPunchDate = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = Math.Max(page, 1);
        var safePageSize = Math.Clamp(pageSize, 20, 500);

        var query = dbContext.AttendanceRawDataItems.AsNoTracking().AsQueryable();

        if (fromPunchDate.HasValue && toPunchDate.HasValue && toPunchDate.Value.Date < fromPunchDate.Value.Date)
        {
            return BadRequest("To punch date cannot be earlier than From punch date.");
        }

        if (!string.IsNullOrWhiteSpace(employeeCode))
        {
            query = ApplyEmployeeCodeFilter(query, employeeCode);
        }

        if (!string.IsNullOrWhiteSpace(sourceType))
        {
            var normalizedSource = sourceType.Trim().ToLowerInvariant();
            query = query.Where(x => x.SourceType.ToLower() == normalizedSource);
        }

        if (uploadBatchId.HasValue)
        {
            query = query.Where(x => x.UploadBatchId == uploadBatchId.Value);
        }

        if (fromPunchDate.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(fromPunchDate.Value.Date, DateTimeKind.Utc);
            query = query.Where(x => x.PunchTime.HasValue && x.PunchTime.Value >= fromUtc);
        }

        if (toPunchDate.HasValue)
        {
            var toUtcExclusive = DateTime.SpecifyKind(toPunchDate.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(x => x.PunchTime.HasValue && x.PunchTime.Value < toUtcExclusive);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)safePageSize);

        var items = await query
            .OrderBy(x => x.EmployeeCode.HasValue ? 0 : 1)
            .ThenBy(x => x.EmployeeCode)
            .ThenBy(x => x.PunchTime.HasValue ? 0 : 1)
            .ThenBy(x => x.PunchTime)
            .ThenBy(x => x.CreatedAtUtc)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AttendanceRawDataResponse
            {
                Id = x.Id,
                UploadBatchId = x.UploadBatchId,
                SourceType = x.SourceType,
                SourceFileName = x.SourceFileName,
                EmployeeCode = x.EmployeeCode,
                DeviceEmployeeCode = x.DeviceEmployeeCode,
                PunchTime = x.PunchTime,
                RawPayload = x.RawPayload,
                CreatedAtUtc = x.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AttendanceRawDataResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = safePage,
            PageSize = safePageSize,
            TotalPages = totalPages
        });
    }

    [HttpDelete("by-date-range")]
    public async Task<ActionResult<object>> DeleteByDateRange(
        [FromQuery] DateTime? fromPunchDate,
        [FromQuery] DateTime? toPunchDate,
        [FromQuery] string? employeeCode = null,
        CancellationToken cancellationToken = default)
    {
        if (!fromPunchDate.HasValue || !toPunchDate.HasValue)
        {
            return BadRequest("From punch date and To punch date are required.");
        }

        if (toPunchDate.Value.Date < fromPunchDate.Value.Date)
        {
            return BadRequest("To punch date cannot be earlier than From punch date.");
        }

        var fromUtc = DateTime.SpecifyKind(fromPunchDate.Value.Date, DateTimeKind.Utc);
        var toUtcExclusive = DateTime.SpecifyKind(toPunchDate.Value.Date.AddDays(1), DateTimeKind.Utc);

        var deleteQuery = dbContext.AttendanceRawDataItems
            .Where(x => x.PunchTime.HasValue && x.PunchTime.Value >= fromUtc && x.PunchTime.Value < toUtcExclusive);

        if (!string.IsNullOrWhiteSpace(employeeCode))
        {
            deleteQuery = ApplyEmployeeCodeFilter(deleteQuery, employeeCode);
        }

        var deletedCount = await deleteQuery.ExecuteDeleteAsync(cancellationToken);
        return Ok(new { deletedCount });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var entity = await dbContext.AttendanceRawDataItems
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound();
        }

        dbContext.AttendanceRawDataItems.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("upload-mdb")]
    [RequestSizeLimit(600_000_000)]
    public async Task<ActionResult<AttendanceRawDataUploadResultResponse>> UploadMdb(
        [FromForm] AttendanceRawDataUploadRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest("MDB file is required.");
        }

        if (!request.File.FileName.EndsWith(".mdb", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only .mdb files are supported.");
        }

        var tempFilePath = Path.Combine(Path.GetTempPath(), $"att_raw_upload_{Guid.NewGuid():N}.mdb");
        await using (var stream = System.IO.File.Create(tempFilePath))
        {
            await request.File.CopyToAsync(stream, cancellationToken);
        }

        try
        {
            var readResult = ReadRowsFromMdb(tempFilePath, request.File.FileName);
            var uploadBatchId = Guid.NewGuid();
            var nowUtc = DateTime.UtcNow;

            var insertList = readResult.Rows.Select(x => new AttendanceRawData
            {
                Id = Guid.NewGuid(),
                UploadBatchId = uploadBatchId,
                SourceType = readResult.SourceType,
                SourceFileName = Path.GetFileName(request.File.FileName),
                EmployeeCode = x.EmployeeCode,
                DeviceEmployeeCode = x.DeviceEmployeeCode,
                PunchTime = x.PunchTime,
                RawPayload = x.RawPayload,
                CreatedAtUtc = nowUtc
            }).ToList();

            if (insertList.Count > 0)
            {
                dbContext.AttendanceRawDataItems.AddRange(insertList);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Ok(new AttendanceRawDataUploadResultResponse
            {
                UploadBatchId = uploadBatchId,
                SourceType = readResult.SourceType,
                FileName = request.File.FileName,
                TotalRowsRead = readResult.TotalRows,
                InsertedRows = insertList.Count,
                InvalidRowsSkipped = readResult.InvalidRows,
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

    private ReadRowsResult ReadRowsFromMdb(string mdbPath, string fileName)
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
                var sourceType = ResolveSourceType(connection, fileName);
                var sourceRange = GetSourcePunchRange(connection, sourceType);

                var sql = sourceType == SourceTypeAtt2000
                    ? "SELECT U.BADGENUMBER AS EmpNo, C.CHECKTIME AS PunchTime, C.* FROM USERINFO U INNER JOIN CHECKINOUT C ON U.USERID = C.USERID ORDER BY C.CHECKTIME, U.BADGENUMBER"
                    : "SELECT E.FingerNo AS EmpNo, D.KQDatetime AS PunchTime, D.* FROM KQ_KQData D INNER JOIN RS_EmpDynamicInfo E ON D.EmpNo = E.EmpNo ORDER BY D.KQDatetime, E.FingerNo";

                var table = new DataTable();
                using (var adapter = new OleDbDataAdapter(sql, connection))
                {
                    adapter.Fill(table);
                }

                var rows = new List<RawRow>(table.Rows.Count);
                var invalidRows = 0;

                foreach (DataRow row in table.Rows)
                {
                    var hasEmployeeCode = TryParseEmployeeCode(row["EmpNo"], out var employeeCode);
                    var hasPunchTime = TryParsePunchTime(row["PunchTime"], out var punchTime);

                    if (!hasEmployeeCode && !hasPunchTime)
                    {
                        invalidRows++;
                    }

                    rows.Add(new RawRow
                    {
                        EmployeeCode = hasEmployeeCode ? employeeCode : null,
                        DeviceEmployeeCode = hasEmployeeCode ? employeeCode!.Value.ToString() : null,
                        PunchTime = hasPunchTime ? punchTime : null,
                        RawPayload = BuildRawPayload(row)
                    });
                }

                return new ReadRowsResult
                {
                    SourceType = sourceType,
                    TotalRows = table.Rows.Count,
                    InvalidRows = invalidRows,
                    Rows = rows,
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

    private static Dictionary<string, object?> BuildRawPayload(DataRow row)
    {
        var payload = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (DataColumn column in row.Table.Columns)
        {
            var key = column.ColumnName;
            var rawValue = row[column];
            if (rawValue is DBNull)
            {
                payload[key] = null;
                continue;
            }

            payload[key] = rawValue switch
            {
                DateTime dt => NormalizeToUtc(dt).ToString("O"),
                DateOnly dateOnly => dateOnly.ToString("yyyy-MM-dd"),
                TimeOnly timeOnly => timeOnly.ToString("HH:mm:ss"),
                byte[] bytes => Convert.ToBase64String(bytes),
                _ => rawValue
            };
        }

        return payload;
    }

    private static string ResolveSourceType(OleDbConnection connection, string fileName)
    {
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

        if (TryParsePunchTime(reader["MinDt"], out var minParsed))
        {
            minUtc = minParsed;
        }

        if (TryParsePunchTime(reader["MaxDt"], out var maxParsed))
        {
            maxUtc = maxParsed;
        }

        return (minUtc, maxUtc);
    }

    private static bool TryParseEmployeeCode(object? rawValue, out long? employeeCode)
    {
        employeeCode = null;
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

        if (long.TryParse(text, out var parsedLong))
        {
            employeeCode = parsedLong;
            return true;
        }

        if (decimal.TryParse(text, out var parsedDecimal))
        {
            employeeCode = decimal.ToInt64(decimal.Truncate(parsedDecimal));
            return true;
        }

        return false;
    }

    private static bool TryParsePunchTime(object? rawValue, out DateTime? punchTime)
    {
        punchTime = null;
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

    private static IQueryable<AttendanceRawData> ApplyEmployeeCodeFilter(
        IQueryable<AttendanceRawData> query,
        string? employeeCodeText)
    {
        if (string.IsNullOrWhiteSpace(employeeCodeText))
        {
            return query;
        }

        var exactText = employeeCodeText.Trim();
        var normalizedWithoutPrefix = exactText.StartsWith("E", StringComparison.OrdinalIgnoreCase)
            ? exactText[1..]
            : exactText;
        var withPrefix = $"E{normalizedWithoutPrefix}";
        var hasNumeric = long.TryParse(normalizedWithoutPrefix, out var numericEmployeeCode);

        if (!hasNumeric)
        {
            return query.Where(x =>
                x.DeviceEmployeeCode == exactText ||
                x.DeviceEmployeeCode == normalizedWithoutPrefix ||
                x.DeviceEmployeeCode == withPrefix);
        }

        return query.Where(x =>
            x.EmployeeCode == numericEmployeeCode ||
            x.DeviceEmployeeCode == exactText ||
            x.DeviceEmployeeCode == normalizedWithoutPrefix ||
            x.DeviceEmployeeCode == withPrefix);
    }

    private sealed class RawRow
    {
        public long? EmployeeCode { get; init; }
        public string? DeviceEmployeeCode { get; init; }
        public DateTime? PunchTime { get; init; }
        public Dictionary<string, object?> RawPayload { get; init; } = new();
    }

    private sealed class ReadRowsResult
    {
        public string SourceType { get; init; } = string.Empty;
        public int TotalRows { get; init; }
        public int InvalidRows { get; init; }
        public List<RawRow> Rows { get; init; } = [];
        public DateTime? SourceMinPunchTimeUtc { get; init; }
        public DateTime? SourceMaxPunchTimeUtc { get; init; }
    }
}

namespace Payroll.Api.Dtos;

public class AttendanceRawDataResponse
{
    public Guid Id { get; set; }
    public Guid UploadBatchId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public long? EmployeeCode { get; set; }
    public string? DeviceEmployeeCode { get; set; }
    public DateTime? PunchTime { get; set; }
    public Dictionary<string, object?> RawPayload { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
}


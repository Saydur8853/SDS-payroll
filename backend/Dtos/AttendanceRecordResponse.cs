namespace Payroll.Api.Dtos;

public class AttendanceRecordResponse
{
    public Guid Id { get; set; }
    public long EmployeeCode { get; set; }
    public string? EmployeeName { get; set; }
    public string? Company { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
    public DateTime PunchTime { get; set; }
    public DateOnly AttendanceDate { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public string? DeviceEmployeeCode { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

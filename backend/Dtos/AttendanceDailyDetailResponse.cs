namespace Payroll.Api.Dtos;

public class AttendanceDailyDetailResponse
{
    public long EmployeeCode { get; set; }
    public string? EmployeeName { get; set; }
    public string? Company { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
    public DateOnly AttendanceDate { get; set; }
    public DateTime InTime { get; set; }
    public DateTime? OutTime { get; set; }
    public int PunchCount { get; set; }
    public int? WorkedMinutes { get; set; }
    public int? LateMinutes { get; set; }
    public int? EarlyOutMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string? ShiftDisplayName { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
}

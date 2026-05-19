using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class AttendanceRecord
{
    public Guid Id { get; set; }

    public long EmployeeCode { get; set; }

    public DateTime PunchTime { get; set; }

    public DateOnly AttendanceDate { get; set; }

    [MaxLength(30)]
    public string SourceType { get; set; } = string.Empty;

    [MaxLength(260)]
    public string SourceFileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? DeviceEmployeeCode { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

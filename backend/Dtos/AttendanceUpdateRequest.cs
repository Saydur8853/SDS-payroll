using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class AttendanceUpdateRequest
{
    [Required]
    public long? EmployeeCode { get; set; }

    [Required]
    public DateTime? PunchTime { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class EmployeeCreateRequest
{
    [Required]
    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(50)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Department { get; set; }

    [MaxLength(100)]
    public string? Designation { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    public DateOnly JoiningDate { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
}

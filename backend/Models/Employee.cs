using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Employee
{
    public Guid Id { get; set; }

    [MaxLength(50)]
    public required string EmployeeCode { get; set; }

    [MaxLength(200)]
    public required string FullName { get; set; }

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

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

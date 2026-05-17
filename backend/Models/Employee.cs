using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Employee
{
    public Guid Id { get; set; }

    public long EmployeeCode { get; set; }

    [MaxLength(200)]
    public required string FullName { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    [MaxLength(50)]
    public required string Phone { get; set; }

    [MaxLength(100)]
    public string? Department { get; set; }
    public Guid? DepartmentId { get; set; }
    public Department? DepartmentLookup { get; set; }

    [MaxLength(100)]
    public string? Designation { get; set; }
    public Guid? DesignationId { get; set; }
    public Designation? DesignationLookup { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(200)]
    public string? FatherName { get; set; }

    [MaxLength(200)]
    public string? MotherName { get; set; }

    [MaxLength(200)]
    public string? SpouseName { get; set; }

    [MaxLength(50)]
    public string? FatherPhone { get; set; }

    [MaxLength(50)]
    public string? MotherPhone { get; set; }

    [MaxLength(50)]
    public string? SpousePhone { get; set; }

    [MaxLength(50)]
    public string? Gender { get; set; }

    [MaxLength(100)]
    public string? Religion { get; set; }

    [MaxLength(50)]
    public string? MaritalStatus { get; set; }

    [MaxLength(20)]
    public string? BloodGroup { get; set; }

    [MaxLength(100)]
    public string? NationalId { get; set; }

    [MaxLength(100)]
    public required string EmploymentStatus { get; set; }

    public byte[]? Photo { get; set; }
    public byte[]? Signature { get; set; }

    [MaxLength(100)]
    public string? WorkingTime { get; set; }
    public Guid? ShiftId { get; set; }
    public Shift? ShiftLookup { get; set; }

    [MaxLength(100)]
    public string? SalaryRule { get; set; }

    public decimal? GrossSalary { get; set; }
    public decimal? BasicSalary { get; set; }

    [MaxLength(100)]
    public string? Weekend { get; set; }

    [MaxLength(100)]
    public string? SalaryAccount { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public DateOnly JoiningDate { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

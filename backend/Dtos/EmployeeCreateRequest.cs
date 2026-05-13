using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class EmployeeCreateRequest
{
    [Required]
    public long EmployeeCode { get; set; }

    [Required]
    [MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Email { get; set; }

    [Required]
    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Department { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Designation { get; set; } = string.Empty;

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

    [Required]
    [MaxLength(50)]
    public string Gender { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Religion { get; set; }

    [MaxLength(50)]
    public string? MaritalStatus { get; set; }

    [MaxLength(20)]
    public string? BloodGroup { get; set; }

    [MaxLength(100)]
    public string? NationalId { get; set; }

    [Required]
    [MaxLength(100)]
    public string EmploymentStatus { get; set; } = string.Empty;

    public string? PhotoBase64 { get; set; }
    public string? SignatureBase64 { get; set; }

    [MaxLength(100)]
    public string? WorkingTime { get; set; }

    [MaxLength(100)]
    public string? SalaryRule { get; set; }

    public decimal? GrossSalary { get; set; }
    public decimal? BasicSalary { get; set; }

    [MaxLength(100)]
    public string? Weekend { get; set; }

    [MaxLength(100)]
    public string? SalaryAccount { get; set; }

    [Required]
    public DateOnly? DateOfBirth { get; set; }

    public DateOnly JoiningDate { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
}

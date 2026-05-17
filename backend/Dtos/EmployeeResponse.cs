namespace Payroll.Api.Dtos;

public class EmployeeResponse
{
    public Guid Id { get; set; }
    public long EmployeeCode { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? Department { get; set; }
    public Guid? DesignationId { get; set; }
    public string? Designation { get; set; }
    public string? Address { get; set; }
    public string? FatherName { get; set; }
    public string? MotherName { get; set; }
    public string? SpouseName { get; set; }
    public string? FatherPhone { get; set; }
    public string? MotherPhone { get; set; }
    public string? SpousePhone { get; set; }
    public string? Gender { get; set; }
    public string? Religion { get; set; }
    public string? MaritalStatus { get; set; }
    public string? BloodGroup { get; set; }
    public string? NationalId { get; set; }
    public string? EmploymentStatus { get; set; }
    public string? PhotoBase64 { get; set; }
    public string? SignatureBase64 { get; set; }
    public Guid? ShiftId { get; set; }
    public string? WorkingTime { get; set; }
    public string? SalaryRule { get; set; }
    public decimal? GrossSalary { get; set; }
    public decimal? BasicSalary { get; set; }
    public string? Weekend { get; set; }
    public string? SalaryAccount { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public DateOnly JoiningDate { get; set; }
    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

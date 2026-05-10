namespace Payroll.Api.Dtos;

public class EmployeeResponse
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }
    public string? Address { get; set; }
    public DateOnly JoiningDate { get; set; }
    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

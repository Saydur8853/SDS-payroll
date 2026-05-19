using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class SalaryRule
{
    public Guid Id { get; set; }

    [MaxLength(150)]
    public required string RuleName { get; set; }

    public decimal BasicSalary { get; set; }
    public decimal HouseRent { get; set; }
    public decimal MedicalBill { get; set; }
    public decimal TransportBill { get; set; }
    public decimal FoodAllowance { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

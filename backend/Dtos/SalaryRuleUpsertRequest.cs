using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class SalaryRuleUpsertRequest
{
    [Required]
    [MaxLength(150)]
    public string RuleName { get; set; } = string.Empty;

    public decimal BasicSalary { get; set; }
    public decimal HouseRent { get; set; }
    public decimal MedicalBill { get; set; }
    public decimal TransportBill { get; set; }
    public decimal FoodAllowance { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
}

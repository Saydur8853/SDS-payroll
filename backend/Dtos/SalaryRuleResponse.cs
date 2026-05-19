namespace Payroll.Api.Dtos;

public class SalaryRuleResponse
{
    public Guid Id { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public decimal BasicSalary { get; set; }
    public decimal HouseRent { get; set; }
    public decimal MedicalBill { get; set; }
    public decimal TransportBill { get; set; }
    public decimal FoodAllowance { get; set; }
    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

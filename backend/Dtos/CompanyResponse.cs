namespace Payroll.Api.Dtos;

public class CompanyResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

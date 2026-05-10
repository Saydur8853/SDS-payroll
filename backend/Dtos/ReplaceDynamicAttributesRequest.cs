namespace Payroll.Api.Dtos;

public class ReplaceDynamicAttributesRequest
{
    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
}

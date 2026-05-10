using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class DynamicAttributeUpsertRequest
{
    [Required]
    public string Value { get; set; } = string.Empty;
}

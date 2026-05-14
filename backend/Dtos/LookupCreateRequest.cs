using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class LookupCreateRequest
{
    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();
}

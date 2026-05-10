using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class CompanyUpdateRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? LogoUrl { get; set; }
}

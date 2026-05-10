using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class CompanyCreateWithFileRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    public IFormFile? LogoFile { get; set; }

    // JSON format example: {"Industry":"Textile","PayrollCycle":"Monthly"}
    public string? DynamicAttributesJson { get; set; }
}

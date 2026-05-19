using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class AuthorizerUpdateRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public Guid? DesignationId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Designation { get; set; } = string.Empty;

    public Guid? DepartmentId { get; set; }

    [Required]
    [MaxLength(100)]
    public string Department { get; set; } = string.Empty;

    public string? PhotoBase64 { get; set; }
    public string? SignatureBase64 { get; set; }

    [Required]
    [MaxLength(200)]
    public string PinPassword { get; set; } = string.Empty;
}

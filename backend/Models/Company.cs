using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Company
{
    public Guid Id { get; set; }

    [MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public required string Address { get; set; }

    [MaxLength(2000)]
    public string? LogoUrl { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

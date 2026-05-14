using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Designation
{
    public Guid Id { get; set; }

    [MaxLength(150)]
    public required string Name { get; set; }

    public Dictionary<string, string?> DynamicAttributes { get; set; } = new();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

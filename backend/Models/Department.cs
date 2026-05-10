using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Department
{
    public Guid Id { get; set; }

    [MaxLength(150)]
    public required string Name { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

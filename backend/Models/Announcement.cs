using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Announcement
{
    public Guid Id { get; set; }

    [MaxLength(200)]
    public required string Title { get; set; }

    [MaxLength(2000)]
    public required string Message { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class ShiftTemporaryOverride
{
    public Guid Id { get; set; }

    public Guid ShiftId { get; set; }
    public Shift Shift { get; set; } = null!;

    public DateOnly DateFrom { get; set; }
    public DateOnly DateTo { get; set; }

    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

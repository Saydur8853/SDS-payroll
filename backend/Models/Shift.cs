using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Shift
{
    public Guid Id { get; set; }

    [MaxLength(150)]
    public required string Name { get; set; }

    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }
    public TimeOnly? InTimeGrace { get; set; }
    public TimeOnly? OutTimeGrace { get; set; }
    public TimeOnly? BreakStartTime { get; set; }
    public TimeOnly? BreakEndTime { get; set; }
    public ICollection<ShiftTemporaryOverride> TemporaryOverrides { get; set; } = new List<ShiftTemporaryOverride>();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

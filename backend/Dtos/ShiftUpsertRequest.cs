using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class ShiftUpsertRequest
{
    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }
    public TimeOnly? InTimeGrace { get; set; }
    public TimeOnly? OutTimeGrace { get; set; }
    public TimeOnly? BreakStartTime { get; set; }
    public TimeOnly? BreakEndTime { get; set; }
}

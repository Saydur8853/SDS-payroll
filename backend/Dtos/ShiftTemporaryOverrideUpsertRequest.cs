using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class ShiftTemporaryOverrideUpsertRequest
{
    [Required]
    public DateOnly DateFrom { get; set; }

    [Required]
    public DateOnly DateTo { get; set; }

    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    public bool IsActive { get; set; } = true;
}

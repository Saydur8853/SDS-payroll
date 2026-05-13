namespace Payroll.Api.Dtos;

public class ShiftTemporaryOverrideResponse
{
    public Guid Id { get; set; }
    public Guid ShiftId { get; set; }
    public DateOnly DateFrom { get; set; }
    public DateOnly DateTo { get; set; }
    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }
    public string? Reason { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

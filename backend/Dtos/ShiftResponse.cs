namespace Payroll.Api.Dtos;

public class ShiftResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeOnly? InTime { get; set; }
    public TimeOnly? OutTime { get; set; }
    public TimeOnly? InTimeGrace { get; set; }
    public TimeOnly? OutTimeGrace { get; set; }
    public TimeOnly? BreakStartTime { get; set; }
    public TimeOnly? BreakEndTime { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public List<ShiftTemporaryOverrideResponse> TemporaryOverrides { get; set; } = [];
}

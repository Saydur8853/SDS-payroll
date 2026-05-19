namespace Payroll.Api.Dtos;

public class AuthorizerResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? DesignationId { get; set; }
    public string Designation { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public string Department { get; set; } = string.Empty;
    public string? PhotoBase64 { get; set; }
    public string? SignatureBase64 { get; set; }
    public string PinPassword { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Models;

public class Authorizer
{
    public Guid Id { get; set; }

    [MaxLength(200)]
    public required string Name { get; set; }

    [MaxLength(100)]
    public required string Designation { get; set; }
    public Guid? DesignationId { get; set; }
    public Designation? DesignationLookup { get; set; }

    [MaxLength(100)]
    public required string Department { get; set; }
    public Guid? DepartmentId { get; set; }
    public Department? DepartmentLookup { get; set; }

    public byte[]? Photo { get; set; }
    public byte[]? Signature { get; set; }

    [MaxLength(200)]
    public required string PinPassword { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

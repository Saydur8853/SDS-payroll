using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class AttendanceUploadRequest
{
    [Required]
    public IFormFile? File { get; set; }

    public string? SourceType { get; set; }

    [Required]
    public DateOnly? FromDate { get; set; }

    [Required]
    public DateOnly? ToDate { get; set; }

    public bool ReplaceExisting { get; set; } = true;

    public string? Company { get; set; }
    public string? Department { get; set; }
    public string? Designation { get; set; }

    public string? EmployeeCodesCsv { get; set; }
}

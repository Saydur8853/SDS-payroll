using System.ComponentModel.DataAnnotations;

namespace Payroll.Api.Dtos;

public class AnnouncementUpsertRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(2000)]
    public string Message { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

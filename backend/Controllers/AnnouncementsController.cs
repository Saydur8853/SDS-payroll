using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnnouncementsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AnnouncementResponse>>> GetAll(
        [FromQuery] bool includeInactive,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Announcements.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(x => x.IsActive);
        }

        var announcements = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(announcements.Select(MapToResponse));
    }

    [HttpPost]
    public async Task<ActionResult<AnnouncementResponse>> Create(
        [FromBody] AnnouncementUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRequest(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var announcement = new Announcement
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            IsActive = request.IsActive
        };

        dbContext.Announcements.Add(announcement);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(announcement));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AnnouncementResponse>> Update(
        Guid id,
        [FromBody] AnnouncementUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var announcement = await dbContext.Announcements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (announcement is null)
        {
            return NotFound();
        }

        var validationError = ValidateRequest(request);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        announcement.Title = request.Title.Trim();
        announcement.Message = request.Message.Trim();
        announcement.IsActive = request.IsActive;
        announcement.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(announcement));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var announcement = await dbContext.Announcements.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (announcement is null)
        {
            return NotFound();
        }

        dbContext.Announcements.Remove(announcement);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static string? ValidateRequest(AnnouncementUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return "Announcement title is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return "Announcement message is required.";
        }

        return null;
    }

    private static AnnouncementResponse MapToResponse(Announcement announcement)
    {
        return new AnnouncementResponse
        {
            Id = announcement.Id,
            Title = announcement.Title,
            Message = announcement.Message,
            IsActive = announcement.IsActive,
            CreatedAtUtc = announcement.CreatedAtUtc,
            UpdatedAtUtc = announcement.UpdatedAtUtc
        };
    }
}

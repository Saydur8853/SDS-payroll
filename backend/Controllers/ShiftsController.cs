using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;
using System.Globalization;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ShiftsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ShiftResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var shifts = await dbContext.Shifts
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(shifts.Select(MapToResponse));
    }

    [HttpGet("lookup")]
    public async Task<ActionResult<IEnumerable<LookupResponse>>> GetLookup(CancellationToken cancellationToken)
    {
        var shifts = await dbContext.Shifts
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(shifts.Select(x => new LookupResponse
        {
            Id = x.Id,
            Name = BuildDisplayName(x.Name, x.InTime, x.OutTime)
        }));
    }

    [HttpPost]
    public async Task<ActionResult<ShiftResponse>> Create(
        [FromBody] ShiftUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Shift name is required.");
        }

        if (!HasRequiredTimes(request))
        {
            return BadRequest("All shift time fields are required.");
        }

        var exists = await dbContext.Shifts
            .AnyAsync(x => x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Shift already exists.");
        }

        var shift = new Shift
        {
            Id = Guid.NewGuid(),
            Name = name,
            InTime = request.InTime,
            OutTime = request.OutTime,
            InTimeGrace = request.InTimeGrace,
            OutTimeGrace = request.OutTimeGrace,
            BreakStartTime = request.BreakStartTime,
            BreakEndTime = request.BreakEndTime
        };

        dbContext.Shifts.Add(shift);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(shift));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ShiftResponse>> Update(
        Guid id,
        [FromBody] ShiftUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var shift = await dbContext.Shifts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (shift is null)
        {
            return NotFound();
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Shift name is required.");
        }

        if (!HasRequiredTimes(request))
        {
            return BadRequest("All shift time fields are required.");
        }

        var exists = await dbContext.Shifts
            .AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Shift already exists.");
        }

        shift.Name = name;
        shift.InTime = request.InTime;
        shift.OutTime = request.OutTime;
        shift.InTimeGrace = request.InTimeGrace;
        shift.OutTimeGrace = request.OutTimeGrace;
        shift.BreakStartTime = request.BreakStartTime;
        shift.BreakEndTime = request.BreakEndTime;
        shift.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(shift));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var shift = await dbContext.Shifts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (shift is null)
        {
            return NotFound();
        }

        dbContext.Shifts.Remove(shift);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static bool HasRequiredTimes(ShiftUpsertRequest request)
    {
        return request.InTime.HasValue
            && request.OutTime.HasValue
            && request.InTimeGrace.HasValue
            && request.OutTimeGrace.HasValue
            && request.BreakStartTime.HasValue
            && request.BreakEndTime.HasValue;
    }

    private static ShiftResponse MapToResponse(Shift shift)
    {
        return new ShiftResponse
        {
            Id = shift.Id,
            Name = shift.Name,
            InTime = shift.InTime,
            OutTime = shift.OutTime,
            InTimeGrace = shift.InTimeGrace,
            OutTimeGrace = shift.OutTimeGrace,
            BreakStartTime = shift.BreakStartTime,
            BreakEndTime = shift.BreakEndTime,
            DisplayName = BuildDisplayName(shift.Name, shift.InTime, shift.OutTime)
        };
    }

    private static string BuildDisplayName(string name, TimeOnly? inTime, TimeOnly? outTime)
    {
        if (!inTime.HasValue || !outTime.HasValue)
        {
            return name;
        }

        var start = DateTime.Today.Add(inTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        var end = DateTime.Today.Add(outTime.Value.ToTimeSpan()).ToString("hh:mm tt", CultureInfo.InvariantCulture);
        return $"{name} - {start} : {end}";
    }
}

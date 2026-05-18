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
    public sealed class ShiftUsageResponse
    {
        public Guid ShiftId { get; init; }
        public string ShiftName { get; init; } = string.Empty;
        public string ShiftDisplayName { get; init; } = string.Empty;
        public int EmployeeCount { get; init; }
        public IReadOnlyList<ShiftEmployeeSummary> Employees { get; init; } = [];
    }

    public sealed class ShiftEmployeeSummary
    {
        public Guid Id { get; init; }
        public long EmployeeCode { get; init; }
        public string FullName { get; init; } = string.Empty;
    }

    public sealed class MoveShiftEmployeesRequest
    {
        public Guid TargetShiftId { get; init; }
        public bool DeleteSourceShiftAfterMove { get; init; } = true;
        public IReadOnlyList<Guid>? EmployeeIds { get; init; }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ShiftResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var shifts = await dbContext.Shifts
            .AsNoTracking()
            .Include(x => x.TemporaryOverrides)
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
            return BadRequest("In/Out time and grace time fields are required.");
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
            return BadRequest("In/Out time and grace time fields are required.");
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

        var shiftDisplayName = BuildDisplayName(shift.Name, shift.InTime, shift.OutTime).ToLower();
        var shiftName = shift.Name.ToLower();
        var employeeCount = await dbContext.Employees
            .AsNoTracking()
            .CountAsync(x =>
                x.ShiftId == id ||
                (x.ShiftId == null &&
                 x.WorkingTime != null &&
                 (x.WorkingTime.ToLower() == shiftDisplayName ||
                  x.WorkingTime.ToLower() == shiftName ||
                  x.WorkingTime.ToLower().StartsWith($"{shiftName} -"))),
                cancellationToken);
        if (employeeCount > 0)
        {
            return Conflict($"Cannot delete shift '{shift.Name}' because {employeeCount} employee(s) are assigned. Move employees to another shift first.");
        }

        dbContext.Shifts.Remove(shift);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/usage")]
    public async Task<ActionResult<ShiftUsageResponse>> GetUsage(Guid id, CancellationToken cancellationToken)
    {
        var shift = await dbContext.Shifts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (shift is null)
        {
            return NotFound();
        }

        var shiftDisplayName = BuildDisplayName(shift.Name, shift.InTime, shift.OutTime);
        var shiftDisplayKey = shiftDisplayName.ToLower();
        var shiftNameKey = shift.Name.ToLower();

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(x =>
                x.ShiftId == id ||
                (x.ShiftId == null &&
                 x.WorkingTime != null &&
                 (x.WorkingTime.ToLower() == shiftDisplayKey ||
                  x.WorkingTime.ToLower() == shiftNameKey ||
                  x.WorkingTime.ToLower().StartsWith($"{shiftNameKey} -"))))
            .OrderBy(x => x.EmployeeCode)
            .Select(x => new ShiftEmployeeSummary
            {
                Id = x.Id,
                EmployeeCode = x.EmployeeCode,
                FullName = x.FullName
            })
            .ToListAsync(cancellationToken);

        return Ok(new ShiftUsageResponse
        {
            ShiftId = shift.Id,
            ShiftName = shift.Name,
            ShiftDisplayName = shiftDisplayName,
            EmployeeCount = employees.Count,
            Employees = employees
        });
    }

    [HttpPost("{id:guid}/move-employees")]
    public async Task<IActionResult> MoveEmployees(
        Guid id,
        [FromBody] MoveShiftEmployeesRequest request,
        CancellationToken cancellationToken)
    {
        if (request.TargetShiftId == Guid.Empty)
        {
            return BadRequest("Target shift is required.");
        }

        if (request.TargetShiftId == id)
        {
            return BadRequest("Target shift must be different from source shift.");
        }

        var sourceShift = await dbContext.Shifts.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (sourceShift is null)
        {
            return NotFound($"Source shift '{id}' was not found.");
        }

        var targetShift = await dbContext.Shifts.FirstOrDefaultAsync(x => x.Id == request.TargetShiftId, cancellationToken);
        if (targetShift is null)
        {
            return NotFound($"Target shift '{request.TargetShiftId}' was not found.");
        }

        var sourceDisplayName = BuildDisplayName(sourceShift.Name, sourceShift.InTime, sourceShift.OutTime);
        var sourceDisplayKey = sourceDisplayName.ToLower();
        var sourceNameKey = sourceShift.Name.ToLower();

        var employeesToMove = await dbContext.Employees
            .Where(x =>
                x.ShiftId == id ||
                (x.ShiftId == null &&
                 x.WorkingTime != null &&
                 (x.WorkingTime.ToLower() == sourceDisplayKey ||
                  x.WorkingTime.ToLower() == sourceNameKey ||
                  x.WorkingTime.ToLower().StartsWith($"{sourceNameKey} -"))))
            .ToListAsync(cancellationToken);

        if (request.EmployeeIds is { Count: > 0 })
        {
            var selectedIds = request.EmployeeIds.Distinct().ToHashSet();
            employeesToMove = employeesToMove
                .Where(x => selectedIds.Contains(x.Id))
                .ToList();
        }

        if (request.EmployeeIds is { Count: 0 })
        {
            return BadRequest("Select at least one employee to move.");
        }

        var targetDisplayName = BuildDisplayName(targetShift.Name, targetShift.InTime, targetShift.OutTime);
        foreach (var employee in employeesToMove)
        {
            employee.ShiftId = targetShift.Id;
            employee.WorkingTime = targetDisplayName;
            employee.UpdatedAtUtc = DateTime.UtcNow;
        }

        var movedCount = employeesToMove.Count;
        var sourceDeleted = false;
        if (request.DeleteSourceShiftAfterMove)
        {
            var hasRemainingEmployees = await dbContext.Employees
                .AnyAsync(x =>
                    x.ShiftId == id ||
                    (x.ShiftId == null &&
                     x.WorkingTime != null &&
                     (x.WorkingTime.ToLower() == sourceDisplayKey ||
                      x.WorkingTime.ToLower() == sourceNameKey ||
                      x.WorkingTime.ToLower().StartsWith($"{sourceNameKey} -"))),
                    cancellationToken);
            if (!hasRemainingEmployees)
            {
                dbContext.Shifts.Remove(sourceShift);
                sourceDeleted = true;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            movedCount,
            sourceShiftId = id,
            sourceShiftName = sourceShift.Name,
            targetShiftId = targetShift.Id,
            targetShiftName = targetShift.Name,
            sourceDeleted
        });
    }

    [HttpGet("{shiftId:guid}/overrides")]
    public async Task<ActionResult<IEnumerable<ShiftTemporaryOverrideResponse>>> GetOverrides(Guid shiftId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Shifts.AnyAsync(x => x.Id == shiftId, cancellationToken);
        if (!exists)
        {
            return NotFound();
        }

        var overrides = await dbContext.ShiftTemporaryOverrides
            .AsNoTracking()
            .Where(x => x.ShiftId == shiftId)
            .OrderByDescending(x => x.DateFrom)
            .ThenByDescending(x => x.DateTo)
            .ToListAsync(cancellationToken);

        return Ok(overrides.Select(MapOverrideToResponse));
    }

    [HttpPost("{shiftId:guid}/overrides")]
    public async Task<ActionResult<ShiftTemporaryOverrideResponse>> CreateOverride(
        Guid shiftId,
        [FromBody] ShiftTemporaryOverrideUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var shift = await dbContext.Shifts.FirstOrDefaultAsync(x => x.Id == shiftId, cancellationToken);
        if (shift is null)
        {
            return NotFound();
        }

        var validationError = ValidateOverrideRequest(request);
        if (!string.IsNullOrEmpty(validationError))
        {
            return BadRequest(validationError);
        }

        var entity = new ShiftTemporaryOverride
        {
            Id = Guid.NewGuid(),
            ShiftId = shiftId,
            DateFrom = request.DateFrom,
            DateTo = request.DateTo,
            InTime = request.InTime,
            OutTime = request.OutTime,
            Reason = request.Reason?.Trim(),
            IsActive = request.IsActive
        };

        dbContext.ShiftTemporaryOverrides.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapOverrideToResponse(entity));
    }

    [HttpPut("{shiftId:guid}/overrides/{overrideId:guid}")]
    public async Task<ActionResult<ShiftTemporaryOverrideResponse>> UpdateOverride(
        Guid shiftId,
        Guid overrideId,
        [FromBody] ShiftTemporaryOverrideUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await dbContext.ShiftTemporaryOverrides
            .FirstOrDefaultAsync(x => x.Id == overrideId && x.ShiftId == shiftId, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        var validationError = ValidateOverrideRequest(request);
        if (!string.IsNullOrEmpty(validationError))
        {
            return BadRequest(validationError);
        }

        entity.DateFrom = request.DateFrom;
        entity.DateTo = request.DateTo;
        entity.InTime = request.InTime;
        entity.OutTime = request.OutTime;
        entity.Reason = request.Reason?.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapOverrideToResponse(entity));
    }

    [HttpDelete("{shiftId:guid}/overrides/{overrideId:guid}")]
    public async Task<IActionResult> DeleteOverride(Guid shiftId, Guid overrideId, CancellationToken cancellationToken)
    {
        var entity = await dbContext.ShiftTemporaryOverrides
            .FirstOrDefaultAsync(x => x.Id == overrideId && x.ShiftId == shiftId, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        dbContext.ShiftTemporaryOverrides.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static bool HasRequiredTimes(ShiftUpsertRequest request)
    {
        return request.InTime.HasValue
            && request.OutTime.HasValue
            && request.InTimeGrace.HasValue
            && request.OutTimeGrace.HasValue;
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
            DisplayName = BuildDisplayName(shift.Name, shift.InTime, shift.OutTime),
            TemporaryOverrides = shift.TemporaryOverrides
                .OrderByDescending(x => x.DateFrom)
                .ThenByDescending(x => x.DateTo)
                .Select(MapOverrideToResponse)
                .ToList()
        };
    }

    private static ShiftTemporaryOverrideResponse MapOverrideToResponse(ShiftTemporaryOverride value)
    {
        return new ShiftTemporaryOverrideResponse
        {
            Id = value.Id,
            ShiftId = value.ShiftId,
            DateFrom = value.DateFrom,
            DateTo = value.DateTo,
            InTime = value.InTime,
            OutTime = value.OutTime,
            Reason = value.Reason,
            IsActive = value.IsActive,
            CreatedAtUtc = value.CreatedAtUtc,
            UpdatedAtUtc = value.UpdatedAtUtc
        };
    }

    private static string? ValidateOverrideRequest(ShiftTemporaryOverrideUpsertRequest request)
    {
        if (request.DateTo < request.DateFrom)
        {
            return "DateTo cannot be earlier than DateFrom.";
        }

        if (!request.InTime.HasValue && !request.OutTime.HasValue)
        {
            return "At least one of In Time or Out Time is required for temporary override.";
        }

        return null;
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

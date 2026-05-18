using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DesignationsController(AppDbContext dbContext) : ControllerBase
{
    public sealed class DesignationUsageResponse
    {
        public Guid DesignationId { get; init; }
        public string DesignationName { get; init; } = string.Empty;
        public int EmployeeCount { get; init; }
        public IReadOnlyList<DesignationEmployeeSummary> Employees { get; init; } = [];
    }

    public sealed class DesignationEmployeeSummary
    {
        public Guid Id { get; init; }
        public long EmployeeCode { get; init; }
        public string FullName { get; init; } = string.Empty;
    }

    public sealed class MoveDesignationEmployeesRequest
    {
        public Guid TargetDesignationId { get; init; }
        public bool DeleteSourceDesignationAfterMove { get; init; } = true;
        public IReadOnlyList<Guid>? EmployeeIds { get; init; }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LookupResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var designations = await dbContext.Designations
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(designations.Select(x => new LookupResponse
        {
            Id = x.Id,
            Name = x.Name,
            DynamicAttributes = x.DynamicAttributes
        }));
    }

    [HttpPost]
    public async Task<ActionResult<LookupResponse>> Create(
        [FromBody] LookupCreateRequest request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Designation name is required.");
        }

        var exists = await dbContext.Designations
            .AnyAsync(x => x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Designation already exists.");
        }

        var designation = new Designation
        {
            Id = Guid.NewGuid(),
            Name = name,
            DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes)
        };

        dbContext.Designations.Add(designation);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse
        {
            Id = designation.Id,
            Name = designation.Name,
            DynamicAttributes = designation.DynamicAttributes
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LookupResponse>> Update(
        Guid id,
        [FromBody] LookupCreateRequest request,
        CancellationToken cancellationToken)
    {
        var designation = await dbContext.Designations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (designation is null)
        {
            return NotFound();
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Designation name is required.");
        }

        var exists = await dbContext.Designations
            .AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Designation already exists.");
        }

        designation.Name = name;
        designation.DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes);
        designation.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse
        {
            Id = designation.Id,
            Name = designation.Name,
            DynamicAttributes = designation.DynamicAttributes
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var designation = await dbContext.Designations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (designation is null)
        {
            return NotFound();
        }

        var employeeCount = await dbContext.Employees
            .AsNoTracking()
            .CountAsync(x =>
                x.DesignationId == id ||
                (x.DesignationId == null && x.Designation != null && x.Designation.ToLower() == designation.Name.ToLower()),
                cancellationToken);
        if (employeeCount > 0)
        {
            return Conflict($"Cannot delete designation '{designation.Name}' because {employeeCount} employee(s) are assigned. Move employees to another designation first.");
        }

        dbContext.Designations.Remove(designation);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/usage")]
    public async Task<ActionResult<DesignationUsageResponse>> GetUsage(Guid id, CancellationToken cancellationToken)
    {
        var designation = await dbContext.Designations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (designation is null)
        {
            return NotFound();
        }

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(x =>
                x.DesignationId == id ||
                (x.DesignationId == null && x.Designation != null && x.Designation.ToLower() == designation.Name.ToLower()))
            .OrderBy(x => x.EmployeeCode)
            .Select(x => new DesignationEmployeeSummary
            {
                Id = x.Id,
                EmployeeCode = x.EmployeeCode,
                FullName = x.FullName
            })
            .ToListAsync(cancellationToken);

        return Ok(new DesignationUsageResponse
        {
            DesignationId = designation.Id,
            DesignationName = designation.Name,
            EmployeeCount = employees.Count,
            Employees = employees
        });
    }

    [HttpPost("{id:guid}/move-employees")]
    public async Task<IActionResult> MoveEmployees(
        Guid id,
        [FromBody] MoveDesignationEmployeesRequest request,
        CancellationToken cancellationToken)
    {
        if (request.TargetDesignationId == Guid.Empty)
        {
            return BadRequest("Target designation is required.");
        }

        if (request.TargetDesignationId == id)
        {
            return BadRequest("Target designation must be different from source designation.");
        }

        var sourceDesignation = await dbContext.Designations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (sourceDesignation is null)
        {
            return NotFound($"Source designation '{id}' was not found.");
        }

        var targetDesignation = await dbContext.Designations.FirstOrDefaultAsync(x => x.Id == request.TargetDesignationId, cancellationToken);
        if (targetDesignation is null)
        {
            return NotFound($"Target designation '{request.TargetDesignationId}' was not found.");
        }

        var employeesToMove = await dbContext.Employees
            .Where(x =>
                x.DesignationId == id ||
                (x.DesignationId == null && x.Designation != null && x.Designation.ToLower() == sourceDesignation.Name.ToLower()))
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

        foreach (var employee in employeesToMove)
        {
            employee.DesignationId = targetDesignation.Id;
            employee.Designation = targetDesignation.Name;
            employee.UpdatedAtUtc = DateTime.UtcNow;
        }

        var movedCount = employeesToMove.Count;
        var sourceDeleted = false;
        if (request.DeleteSourceDesignationAfterMove)
        {
            var hasRemainingEmployees = await dbContext.Employees
                .AnyAsync(x =>
                    x.DesignationId == id ||
                    (x.DesignationId == null && x.Designation != null && x.Designation.ToLower() == sourceDesignation.Name.ToLower()),
                    cancellationToken);
            if (!hasRemainingEmployees)
            {
                dbContext.Designations.Remove(sourceDesignation);
                sourceDeleted = true;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            movedCount,
            sourceDesignationId = id,
            sourceDesignationName = sourceDesignation.Name,
            targetDesignationId = targetDesignation.Id,
            targetDesignationName = targetDesignation.Name,
            sourceDeleted
        });
    }

    private static Dictionary<string, string?> NormalizeDynamicAttributes(Dictionary<string, string?>? attributes)
    {
        var normalized = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (attributes is null)
        {
            return normalized;
        }

        foreach (var item in attributes)
        {
            var key = item.Key?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            normalized[key] = item.Value?.Trim();
        }

        return normalized;
    }
}

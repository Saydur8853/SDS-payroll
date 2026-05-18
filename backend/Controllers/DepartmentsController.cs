using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DepartmentsController(AppDbContext dbContext) : ControllerBase
{
    public sealed class DepartmentUsageResponse
    {
        public Guid DepartmentId { get; init; }
        public string DepartmentName { get; init; } = string.Empty;
        public int EmployeeCount { get; init; }
        public IReadOnlyList<DepartmentEmployeeSummary> Employees { get; init; } = [];
    }

    public sealed class DepartmentEmployeeSummary
    {
        public Guid Id { get; init; }
        public long EmployeeCode { get; init; }
        public string FullName { get; init; } = string.Empty;
    }

    public sealed class MoveDepartmentEmployeesRequest
    {
        public Guid TargetDepartmentId { get; init; }
        public bool DeleteSourceDepartmentAfterMove { get; init; } = true;
        public IReadOnlyList<Guid>? EmployeeIds { get; init; }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LookupResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var departments = await dbContext.Departments
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(departments.Select(x => new LookupResponse
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
            return BadRequest("Department name is required.");
        }

        var exists = await dbContext.Departments
            .AnyAsync(x => x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Department already exists.");
        }

        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = name,
            DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes)
        };

        dbContext.Departments.Add(department);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse
        {
            Id = department.Id,
            Name = department.Name,
            DynamicAttributes = department.DynamicAttributes
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LookupResponse>> Update(
        Guid id,
        [FromBody] LookupCreateRequest request,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (department is null)
        {
            return NotFound();
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Department name is required.");
        }

        var exists = await dbContext.Departments
            .AnyAsync(x => x.Id != id && x.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Department already exists.");
        }

        department.Name = name;
        department.DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes);
        department.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse
        {
            Id = department.Id,
            Name = department.Name,
            DynamicAttributes = department.DynamicAttributes
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (department is null)
        {
            return NotFound();
        }

        var employeeCount = await dbContext.Employees
            .AsNoTracking()
            .CountAsync(x =>
                x.DepartmentId == id ||
                (x.DepartmentId == null && x.Department != null && x.Department.ToLower() == department.Name.ToLower()),
                cancellationToken);
        if (employeeCount > 0)
        {
            return Conflict($"Cannot delete department '{department.Name}' because {employeeCount} employee(s) are assigned. Move employees to another department first.");
        }

        dbContext.Departments.Remove(department);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/usage")]
    public async Task<ActionResult<DepartmentUsageResponse>> GetUsage(Guid id, CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (department is null)
        {
            return NotFound();
        }

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(x =>
                x.DepartmentId == id ||
                (x.DepartmentId == null && x.Department != null && x.Department.ToLower() == department.Name.ToLower()))
            .OrderBy(x => x.EmployeeCode)
            .Select(x => new DepartmentEmployeeSummary
            {
                Id = x.Id,
                EmployeeCode = x.EmployeeCode,
                FullName = x.FullName
            })
            .ToListAsync(cancellationToken);

        return Ok(new DepartmentUsageResponse
        {
            DepartmentId = department.Id,
            DepartmentName = department.Name,
            EmployeeCount = employees.Count,
            Employees = employees
        });
    }

    [HttpPost("{id:guid}/move-employees")]
    public async Task<IActionResult> MoveEmployees(
        Guid id,
        [FromBody] MoveDepartmentEmployeesRequest request,
        CancellationToken cancellationToken)
    {
        if (request.TargetDepartmentId == Guid.Empty)
        {
            return BadRequest("Target department is required.");
        }

        if (request.TargetDepartmentId == id)
        {
            return BadRequest("Target department must be different from source department.");
        }

        var sourceDepartment = await dbContext.Departments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (sourceDepartment is null)
        {
            return NotFound($"Source department '{id}' was not found.");
        }

        var targetDepartment = await dbContext.Departments.FirstOrDefaultAsync(x => x.Id == request.TargetDepartmentId, cancellationToken);
        if (targetDepartment is null)
        {
            return NotFound($"Target department '{request.TargetDepartmentId}' was not found.");
        }

        var employeesToMove = await dbContext.Employees
            .Where(x =>
                x.DepartmentId == id ||
                (x.DepartmentId == null && x.Department != null && x.Department.ToLower() == sourceDepartment.Name.ToLower()))
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
            employee.DepartmentId = targetDepartment.Id;
            employee.Department = targetDepartment.Name;
            employee.UpdatedAtUtc = DateTime.UtcNow;
        }

        var movedCount = employeesToMove.Count;
        var sourceDeleted = false;
        if (request.DeleteSourceDepartmentAfterMove)
        {
            var hasRemainingEmployees = await dbContext.Employees
                .AnyAsync(x =>
                    x.DepartmentId == id ||
                    (x.DepartmentId == null && x.Department != null && x.Department.ToLower() == sourceDepartment.Name.ToLower()),
                    cancellationToken);
            if (!hasRemainingEmployees)
            {
                dbContext.Departments.Remove(sourceDepartment);
                sourceDeleted = true;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            movedCount,
            sourceDepartmentId = id,
            sourceDepartmentName = sourceDepartment.Name,
            targetDepartmentId = targetDepartment.Id,
            targetDepartmentName = targetDepartment.Name,
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

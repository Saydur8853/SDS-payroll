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
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LookupResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var departments = await dbContext.Departments
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(departments.Select(x => new LookupResponse { Id = x.Id, Name = x.Name }));
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
            Name = name
        };

        dbContext.Departments.Add(department);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse { Id = department.Id, Name = department.Name });
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
        department.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse { Id = department.Id, Name = department.Name });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (department is null)
        {
            return NotFound();
        }

        dbContext.Departments.Remove(department);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

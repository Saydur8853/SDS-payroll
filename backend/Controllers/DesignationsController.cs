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
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LookupResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var designations = await dbContext.Designations
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(designations.Select(x => new LookupResponse { Id = x.Id, Name = x.Name }));
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
            Name = name
        };

        dbContext.Designations.Add(designation);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse { Id = designation.Id, Name = designation.Name });
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
        designation.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new LookupResponse { Id = designation.Id, Name = designation.Name });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var designation = await dbContext.Designations.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (designation is null)
        {
            return NotFound();
        }

        dbContext.Designations.Remove(designation);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

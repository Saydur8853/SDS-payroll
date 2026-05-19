using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalaryRulesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SalaryRuleResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var rules = await dbContext.SalaryRules
            .AsNoTracking()
            .OrderBy(x => x.RuleName)
            .ToListAsync(cancellationToken);

        return Ok(rules.Select(MapToResponse));
    }

    [HttpPost]
    public async Task<ActionResult<SalaryRuleResponse>> Create(
        [FromBody] SalaryRuleUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var ruleName = request.RuleName.Trim();
        if (string.IsNullOrWhiteSpace(ruleName))
        {
            return BadRequest("Rule name is required.");
        }

        if (HasNegativeAmount(request))
        {
            return BadRequest("Salary fields cannot be negative.");
        }

        var exists = await dbContext.SalaryRules
            .AnyAsync(x => x.RuleName.ToLower() == ruleName.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Salary rule already exists.");
        }

        var entity = new SalaryRule
        {
            Id = Guid.NewGuid(),
            RuleName = ruleName,
            BasicSalary = request.BasicSalary,
            HouseRent = request.HouseRent,
            MedicalBill = request.MedicalBill,
            TransportBill = request.TransportBill,
            FoodAllowance = request.FoodAllowance,
            DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes)
        };

        dbContext.SalaryRules.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SalaryRuleResponse>> Update(
        Guid id,
        [FromBody] SalaryRuleUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await dbContext.SalaryRules.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        var ruleName = request.RuleName.Trim();
        if (string.IsNullOrWhiteSpace(ruleName))
        {
            return BadRequest("Rule name is required.");
        }

        if (HasNegativeAmount(request))
        {
            return BadRequest("Salary fields cannot be negative.");
        }

        var exists = await dbContext.SalaryRules
            .AnyAsync(x => x.Id != id && x.RuleName.ToLower() == ruleName.ToLower(), cancellationToken);
        if (exists)
        {
            return Conflict("Salary rule already exists.");
        }

        entity.RuleName = ruleName;
        entity.BasicSalary = request.BasicSalary;
        entity.HouseRent = request.HouseRent;
        entity.MedicalBill = request.MedicalBill;
        entity.TransportBill = request.TransportBill;
        entity.FoodAllowance = request.FoodAllowance;
        entity.DynamicAttributes = NormalizeDynamicAttributes(request.DynamicAttributes);
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var entity = await dbContext.SalaryRules.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return NotFound();
        }

        var employeeCount = await dbContext.Employees
            .AsNoTracking()
            .CountAsync(x => x.SalaryRule != null && x.SalaryRule.ToLower() == entity.RuleName.ToLower(), cancellationToken);
        if (employeeCount > 0)
        {
            return Conflict($"Cannot delete salary rule '{entity.RuleName}' because {employeeCount} employee(s) are assigned.");
        }

        dbContext.SalaryRules.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static SalaryRuleResponse MapToResponse(SalaryRule entity)
    {
        return new SalaryRuleResponse
        {
            Id = entity.Id,
            RuleName = entity.RuleName,
            BasicSalary = entity.BasicSalary,
            HouseRent = entity.HouseRent,
            MedicalBill = entity.MedicalBill,
            TransportBill = entity.TransportBill,
            FoodAllowance = entity.FoodAllowance,
            DynamicAttributes = entity.DynamicAttributes,
            CreatedAtUtc = entity.CreatedAtUtc,
            UpdatedAtUtc = entity.UpdatedAtUtc
        };
    }

    private static bool HasNegativeAmount(SalaryRuleUpsertRequest request)
    {
        return request.BasicSalary < 0
            || request.HouseRent < 0
            || request.MedicalBill < 0
            || request.TransportBill < 0
            || request.FoodAllowance < 0;
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

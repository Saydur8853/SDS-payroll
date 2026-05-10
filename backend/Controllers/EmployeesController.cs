using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("attribute-suggestions")]
    public async Task<ActionResult<IEnumerable<string>>> GetAttributeSuggestions(
        [FromQuery] string? query,
        [FromQuery] int take = 10,
        CancellationToken cancellationToken = default)
    {
        var safeTake = Math.Clamp(take, 1, 30);
        var keyCounts = await GetDynamicAttributeKeyCounts(cancellationToken);
        if (keyCounts.Count == 0)
        {
            return Ok(Array.Empty<string>());
        }

        var normalizedQuery = NormalizeKey(query ?? string.Empty);
        IEnumerable<KeyValuePair<string, int>> ranked;

        if (string.IsNullOrWhiteSpace(normalizedQuery))
        {
            ranked = keyCounts.OrderByDescending(x => x.Value).ThenBy(x => x.Key);
        }
        else
        {
            ranked = keyCounts
                .Select(x => new
                {
                    Key = x.Key,
                    Count = x.Value,
                    Score = CalculateSuggestionScore(normalizedQuery, NormalizeKey(x.Key))
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenByDescending(x => x.Count)
                .ThenBy(x => x.Key)
                .Select(x => new KeyValuePair<string, int>(x.Key, x.Count));
        }

        return Ok(ranked.Take(safeTake).Select(x => x.Key).ToArray());
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<EmployeeResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var employees = await dbContext.Employees
            .AsNoTracking()
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

        return Ok(employees.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (employee is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(employee));
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeResponse>> Create(
        [FromBody] EmployeeCreateRequest request,
        CancellationToken cancellationToken)
    {
        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        var employee = new Employee
        {
            Id = Guid.NewGuid(),
            EmployeeCode = request.EmployeeCode.Trim(),
            FullName = request.FullName.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            Department = request.Department?.Trim(),
            Designation = request.Designation?.Trim(),
            Address = request.Address?.Trim(),
            JoiningDate = request.JoiningDate,
            DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys)
        };

        dbContext.Employees.Add(employee);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, MapToResponse(employee));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EmployeeResponse>> Update(
        Guid id,
        [FromBody] EmployeeUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        employee.EmployeeCode = request.EmployeeCode.Trim();
        employee.FullName = request.FullName.Trim();
        employee.Email = request.Email?.Trim();
        employee.Phone = request.Phone?.Trim();
        employee.Department = request.Department?.Trim();
        employee.Designation = request.Designation?.Trim();
        employee.Address = request.Address?.Trim();
        employee.JoiningDate = request.JoiningDate;
        employee.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpPut("{id:guid}/attributes")]
    public async Task<ActionResult<EmployeeResponse>> ReplaceDynamicAttributes(
        Guid id,
        [FromBody] ReplaceDynamicAttributesRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        employee.DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys);
        employee.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpPut("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<EmployeeResponse>> UpsertDynamicAttribute(
        Guid id,
        string key,
        [FromBody] DynamicAttributeUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var normalizedKey = key.Trim();
        if (string.IsNullOrWhiteSpace(normalizedKey))
        {
            return BadRequest("Attribute key is required.");
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        var canonicalKey = FindCanonicalKey(normalizedKey, existingKeys.Keys) ?? normalizedKey;
        var updatedAttributes = new Dictionary<string, string?>(employee.DynamicAttributes, StringComparer.OrdinalIgnoreCase)
        {
            [canonicalKey] = request.Value
        };

        employee.DynamicAttributes = updatedAttributes;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpDelete("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<EmployeeResponse>> DeleteDynamicAttribute(
        Guid id,
        string key,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        var normalizedKey = key.Trim();
        var updatedAttributes = new Dictionary<string, string?>(employee.DynamicAttributes, StringComparer.OrdinalIgnoreCase);
        if (!updatedAttributes.Remove(normalizedKey))
        {
            return NotFound($"Attribute '{normalizedKey}' not found.");
        }

        employee.DynamicAttributes = updatedAttributes;
        employee.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(employee));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (employee is null)
        {
            return NotFound();
        }

        dbContext.Employees.Remove(employee);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Dictionary<string, int>> GetDynamicAttributeKeyCounts(CancellationToken cancellationToken)
    {
        var allDynamicAttributes = await dbContext.Employees
            .AsNoTracking()
            .Select(x => x.DynamicAttributes)
            .ToListAsync(cancellationToken);

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var attributes in allDynamicAttributes)
        {
            foreach (var key in attributes.Keys)
            {
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                counts.TryGetValue(key, out var current);
                counts[key] = current + 1;
            }
        }

        return counts;
    }

    private static EmployeeResponse MapToResponse(Employee employee) =>
        new()
        {
            Id = employee.Id,
            EmployeeCode = employee.EmployeeCode,
            FullName = employee.FullName,
            Email = employee.Email,
            Phone = employee.Phone,
            Department = employee.Department,
            Designation = employee.Designation,
            Address = employee.Address,
            JoiningDate = employee.JoiningDate,
            DynamicAttributes = employee.DynamicAttributes,
            CreatedAtUtc = employee.CreatedAtUtc,
            UpdatedAtUtc = employee.UpdatedAtUtc
        };

    private static Dictionary<string, string?> CanonicalizeDynamicAttributes(
        Dictionary<string, string?> source,
        IEnumerable<string> existingKeys)
    {
        var keys = existingKeys.ToArray();
        var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in source)
        {
            if (string.IsNullOrWhiteSpace(pair.Key))
            {
                continue;
            }

            var rawKey = pair.Key.Trim();
            var canonicalKey = FindCanonicalKey(rawKey, keys) ?? rawKey;
            result[canonicalKey] = pair.Value;
        }

        return result;
    }

    private static string? FindCanonicalKey(string candidate, IEnumerable<string> existingKeys)
    {
        var normalizedCandidate = NormalizeKey(candidate);
        if (string.IsNullOrWhiteSpace(normalizedCandidate))
        {
            return null;
        }

        return existingKeys.FirstOrDefault(existing =>
            NormalizeKey(existing) == normalizedCandidate);
    }

    private static int CalculateSuggestionScore(string normalizedQuery, string normalizedKey)
    {
        if (string.IsNullOrWhiteSpace(normalizedQuery) || string.IsNullOrWhiteSpace(normalizedKey))
        {
            return 0;
        }

        if (normalizedKey == normalizedQuery)
        {
            return 100;
        }

        if (normalizedKey.StartsWith(normalizedQuery, StringComparison.Ordinal))
        {
            return 85;
        }

        if (normalizedKey.Contains(normalizedQuery, StringComparison.Ordinal))
        {
            return 70;
        }

        var distance = LevenshteinDistance(normalizedQuery, normalizedKey);
        if (distance <= 2)
        {
            return 60 - (distance * 10);
        }

        return 0;
    }

    private static string NormalizeKey(string input)
    {
        var chars = input
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray();

        return new string(chars);
    }

    private static int LevenshteinDistance(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;

        var costs = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++)
        {
            costs[j] = j;
        }

        for (var i = 1; i <= a.Length; i++)
        {
            var previousDiagonal = costs[0];
            costs[0] = i;

            for (var j = 1; j <= b.Length; j++)
            {
                var temp = costs[j];
                var substitutionCost = a[i - 1] == b[j - 1] ? 0 : 1;
                costs[j] = Math.Min(
                    Math.Min(costs[j] + 1, costs[j - 1] + 1),
                    previousDiagonal + substitutionCost);
                previousDiagonal = temp;
            }
        }

        return costs[b.Length];
    }
}

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CompaniesController(AppDbContext dbContext, IWebHostEnvironment environment) : ControllerBase
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
            ranked = keyCounts
                .OrderByDescending(x => x.Value)
                .ThenBy(x => x.Key);
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

        return Ok(ranked
            .Take(safeTake)
            .Select(x => x.Key)
            .ToArray());
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CompanyResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var companies = await dbContext.Companies
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(companies.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CompanyResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (company is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(company));
    }

    [HttpPost]
    public async Task<ActionResult<CompanyResponse>> Create(
        [FromBody] CompanyCreateRequest request,
        CancellationToken cancellationToken)
    {
        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);

        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            LogoUrl = request.LogoUrl?.Trim(),
            Logo = ConvertBase64ToBytes(request.LogoBase64),
            DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys)
        };

        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = company.Id }, MapToResponse(company));
    }

    [HttpPost("with-logo-upload")]
    [RequestSizeLimit(10_000_000)] // 10 MB
    public async Task<ActionResult<CompanyResponse>> CreateWithLogoUpload(
        [FromForm] CompanyCreateWithFileRequest request,
        CancellationToken cancellationToken)
    {
        var dynamicAttributes = ParseDynamicAttributes(request.DynamicAttributesJson);
        if (dynamicAttributes is null)
        {
            return BadRequest("Invalid DynamicAttributesJson. Expected JSON object format.");
        }
        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);

        var logoUrl = request.LogoFile is null
            ? null
            : await SaveLogoAndReturnUrl(request.LogoFile, cancellationToken);

        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Address = request.Address.Trim(),
            LogoUrl = logoUrl,
            DynamicAttributes = CanonicalizeDynamicAttributes(dynamicAttributes, existingKeys.Keys)
        };

        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = company.Id }, MapToResponse(company));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CompanyResponse>> Update(
        Guid id,
        [FromBody] CompanyUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return NotFound();
        }

        company.Name = request.Name.Trim();
        company.Address = request.Address.Trim();
        company.LogoUrl = request.LogoUrl?.Trim();
        if (!string.IsNullOrWhiteSpace(request.LogoBase64))
        {
            company.Logo = ConvertBase64ToBytes(request.LogoBase64);
        }
        company.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(company));
    }

    [HttpPut("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<CompanyResponse>> UpsertDynamicAttribute(
        Guid id,
        string key,
        [FromBody] DynamicAttributeUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
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
        var updatedAttributes = new Dictionary<string, string?>(company.DynamicAttributes, StringComparer.OrdinalIgnoreCase)
        {
            [canonicalKey] = request.Value
        };
        company.DynamicAttributes = updatedAttributes;
        company.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(company));
    }

    [HttpPut("{id:guid}/attributes")]
    public async Task<ActionResult<CompanyResponse>> ReplaceDynamicAttributes(
        Guid id,
        [FromBody] ReplaceDynamicAttributesRequest request,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return NotFound();
        }

        var existingKeys = await GetDynamicAttributeKeyCounts(cancellationToken);
        company.DynamicAttributes = CanonicalizeDynamicAttributes(request.DynamicAttributes, existingKeys.Keys);
        company.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(company));
    }

    [HttpDelete("{id:guid}/attributes/{key}")]
    public async Task<ActionResult<CompanyResponse>> DeleteDynamicAttribute(
        Guid id,
        string key,
        CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return NotFound();
        }

        var normalizedKey = key.Trim();
        var updatedAttributes = new Dictionary<string, string?>(company.DynamicAttributes, StringComparer.OrdinalIgnoreCase);
        if (!updatedAttributes.Remove(normalizedKey))
        {
            return NotFound($"Attribute '{normalizedKey}' not found.");
        }

        company.DynamicAttributes = updatedAttributes;
        company.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapToResponse(company));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return NotFound();
        }

        dbContext.Companies.Remove(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static CompanyResponse MapToResponse(Company company) =>
        new()
        {
            Id = company.Id,
            Name = company.Name,
            Address = company.Address,
            LogoUrl = company.LogoUrl,
            LogoBase64 = company.Logo != null ? $"data:image/webp;base64,{Convert.ToBase64String(company.Logo)}" : null,
            DynamicAttributes = company.DynamicAttributes,
            CreatedAtUtc = company.CreatedAtUtc,
            UpdatedAtUtc = company.UpdatedAtUtc
        };

    private static byte[]? ConvertBase64ToBytes(string? base64String)
    {
        if (string.IsNullOrWhiteSpace(base64String)) return null;
        try
        {
            var parts = base64String.Split(',');
            var base64 = parts.Length > 1 ? parts[1] : parts[0];
            return Convert.FromBase64String(base64);
        }
        catch
        {
            return null;
        }
    }

    private static Dictionary<string, string?>? ParseDynamicAttributes(string? dynamicAttributesJson)
    {
        if (string.IsNullOrWhiteSpace(dynamicAttributesJson))
        {
            return new Dictionary<string, string?>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string?>>(dynamicAttributesJson);
        }
        catch
        {
            return null;
        }
    }

    private async Task<Dictionary<string, int>> GetDynamicAttributeKeyCounts(CancellationToken cancellationToken)
    {
        var allDynamicAttributes = await dbContext.Companies
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

    private async Task<string> SaveLogoAndReturnUrl(IFormFile logoFile, CancellationToken cancellationToken)
    {
        var uploadRoot = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads", "company-logos");
        Directory.CreateDirectory(uploadRoot);

        var fileExtension = Path.GetExtension(logoFile.FileName);
        var savedFileName = $"{Guid.NewGuid():N}{fileExtension}";
        var savePath = Path.Combine(uploadRoot, savedFileName);

        await using var stream = System.IO.File.Create(savePath);
        await logoFile.CopyToAsync(stream, cancellationToken);

        return $"{Request.Scheme}://{Request.Host}/uploads/company-logos/{savedFileName}";
    }
}

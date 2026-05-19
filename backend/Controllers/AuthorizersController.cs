using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Payroll.Api.Data;
using Payroll.Api.Dtos;
using Payroll.Api.Models;

namespace Payroll.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthorizersController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuthorizerResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var authorizers = await dbContext.Authorizers
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        return Ok(authorizers.Select(MapToResponse));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AuthorizerResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var authorizer = await dbContext.Authorizers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (authorizer is null)
        {
            return NotFound();
        }

        return Ok(MapToResponse(authorizer));
    }

    [HttpPost]
    public async Task<ActionResult<AuthorizerResponse>> Create(
        [FromBody] AuthorizerCreateRequest request,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateRequest(request.Name, request.Designation, request.Department, request.PinPassword);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var signatureBytes = FromBase64(request.SignatureBase64);
        if (signatureBytes is null || signatureBytes.Length == 0)
        {
            return BadRequest("Authorizer signature is required.");
        }

        if (await dbContext.Authorizers.AnyAsync(x => x.Name.ToLower() == request.Name.Trim().ToLower(), cancellationToken))
        {
            return Conflict($"Authorizer '{request.Name.Trim()}' already exists.");
        }

        var (designationId, designationName) = await ResolveDesignationAsync(request.DesignationId, request.Designation, cancellationToken);
        var (departmentId, departmentName) = await ResolveDepartmentAsync(request.DepartmentId, request.Department, cancellationToken);

        var authorizer = new Authorizer
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            DesignationId = designationId,
            Designation = designationName,
            DepartmentId = departmentId,
            Department = departmentName,
            Photo = FromBase64(request.PhotoBase64),
            Signature = signatureBytes,
            PinPassword = request.PinPassword.Trim()
        };

        dbContext.Authorizers.Add(authorizer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = authorizer.Id }, MapToResponse(authorizer));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AuthorizerResponse>> Update(
        Guid id,
        [FromBody] AuthorizerUpdateRequest request,
        CancellationToken cancellationToken)
    {
        var authorizer = await dbContext.Authorizers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (authorizer is null)
        {
            return NotFound();
        }

        var validationError = ValidateRequest(request.Name, request.Designation, request.Department, request.PinPassword);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        if (await dbContext.Authorizers.AnyAsync(x => x.Id != id && x.Name.ToLower() == request.Name.Trim().ToLower(), cancellationToken))
        {
            return Conflict($"Authorizer '{request.Name.Trim()}' already exists.");
        }

        var (designationId, designationName) = await ResolveDesignationAsync(request.DesignationId, request.Designation, cancellationToken);
        var (departmentId, departmentName) = await ResolveDepartmentAsync(request.DepartmentId, request.Department, cancellationToken);
        var signatureBytes = request.SignatureBase64 != null ? FromBase64(request.SignatureBase64) : authorizer.Signature;
        if (signatureBytes is null || signatureBytes.Length == 0)
        {
            return BadRequest("Authorizer signature is required.");
        }

        authorizer.Name = request.Name.Trim();
        authorizer.DesignationId = designationId;
        authorizer.Designation = designationName;
        authorizer.DepartmentId = departmentId;
        authorizer.Department = departmentName;
        authorizer.PinPassword = request.PinPassword.Trim();
        authorizer.Photo = request.PhotoBase64 != null ? FromBase64(request.PhotoBase64) : authorizer.Photo;
        authorizer.Signature = signatureBytes;
        authorizer.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(authorizer));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var authorizer = await dbContext.Authorizers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (authorizer is null)
        {
            return NotFound();
        }

        dbContext.Authorizers.Remove(authorizer);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<(Guid? id, string name)> ResolveDesignationAsync(Guid? designationId, string designationName, CancellationToken cancellationToken)
    {
        if (designationId.HasValue)
        {
            var designation = await dbContext.Designations
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == designationId.Value, cancellationToken);
            if (designation is not null)
            {
                return (designation.Id, designation.Name);
            }
        }

        var normalized = designationName.Trim();
        var byName = await dbContext.Designations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Name.ToLower() == normalized.ToLower(), cancellationToken);
        if (byName is not null)
        {
            return (byName.Id, byName.Name);
        }

        return (null, normalized);
    }

    private async Task<(Guid? id, string name)> ResolveDepartmentAsync(Guid? departmentId, string departmentName, CancellationToken cancellationToken)
    {
        if (departmentId.HasValue)
        {
            var department = await dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == departmentId.Value, cancellationToken);
            if (department is not null)
            {
                return (department.Id, department.Name);
            }
        }

        var normalized = departmentName.Trim();
        var byName = await dbContext.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Name.ToLower() == normalized.ToLower(), cancellationToken);
        if (byName is not null)
        {
            return (byName.Id, byName.Name);
        }

        return (null, normalized);
    }

    private static AuthorizerResponse MapToResponse(Authorizer authorizer) =>
        new()
        {
            Id = authorizer.Id,
            Name = authorizer.Name,
            DesignationId = authorizer.DesignationId,
            Designation = authorizer.Designation,
            DepartmentId = authorizer.DepartmentId,
            Department = authorizer.Department,
            PhotoBase64 = ToBase64(authorizer.Photo),
            SignatureBase64 = ToBase64(authorizer.Signature),
            PinPassword = authorizer.PinPassword,
            CreatedAtUtc = authorizer.CreatedAtUtc,
            UpdatedAtUtc = authorizer.UpdatedAtUtc
        };

    private static string? ValidateRequest(string? name, string? designation, string? department, string? pinPassword)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Authorizer name is required.";
        }

        if (string.IsNullOrWhiteSpace(designation))
        {
            return "Authorizer designation is required.";
        }

        if (string.IsNullOrWhiteSpace(department))
        {
            return "Authorizer department is required.";
        }

        if (string.IsNullOrWhiteSpace(pinPassword))
        {
            return "PIN/Password is required.";
        }

        var trimmedCredential = pinPassword.Trim();
        var isDigitsOnly = trimmedCredential.All(char.IsDigit);
        if (isDigitsOnly && trimmedCredential.Length != 4)
        {
            return "If using PIN, it must be exactly 4 digits.";
        }

        return null;
    }

    private static byte[]? FromBase64(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return null;
        try
        {
            var source = base64;
            if (source.Contains(',')) source = source.Split(',')[1];
            return Convert.FromBase64String(source);
        }
        catch
        {
            return null;
        }
    }

    private static string? ToBase64(byte[]? bytes)
    {
        if (bytes == null || bytes.Length == 0) return null;
        var mimeType = DetectImageMimeType(bytes);
        return $"data:{mimeType};base64,{Convert.ToBase64String(bytes)}";
    }

    private static string DetectImageMimeType(byte[] bytes)
    {
        if (bytes.Length >= 12 &&
            bytes[0] == 0x52 &&
            bytes[1] == 0x49 &&
            bytes[2] == 0x46 &&
            bytes[3] == 0x46 &&
            bytes[8] == 0x57 &&
            bytes[9] == 0x45 &&
            bytes[10] == 0x42 &&
            bytes[11] == 0x50)
        {
            return "image/webp";
        }

        if (bytes.Length >= 8 &&
            bytes[0] == 0x89 &&
            bytes[1] == 0x50 &&
            bytes[2] == 0x4E &&
            bytes[3] == 0x47 &&
            bytes[4] == 0x0D &&
            bytes[5] == 0x0A &&
            bytes[6] == 0x1A &&
            bytes[7] == 0x0A)
        {
            return "image/png";
        }

        if (bytes.Length >= 3 &&
            bytes[0] == 0xFF &&
            bytes[1] == 0xD8 &&
            bytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        return "image/webp";
    }
}

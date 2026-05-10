using Microsoft.EntityFrameworkCore;
using Payroll.Api.Models;

namespace Payroll.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Address).IsRequired().HasMaxLength(500);
            entity.Property(e => e.LogoUrl).HasMaxLength(2000);
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
        });
    }
}

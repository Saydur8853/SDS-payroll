using Microsoft.EntityFrameworkCore;
using Payroll.Api.Models;

namespace Payroll.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Authorizer> Authorizers => Set<Authorizer>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<AttendanceRawData> AttendanceRawDataItems => Set<AttendanceRawData>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Designation> Designations => Set<Designation>();
    public DbSet<SalaryRule> SalaryRules => Set<SalaryRule>();
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<ShiftTemporaryOverride> ShiftTemporaryOverrides => Set<ShiftTemporaryOverride>();

    public override int SaveChanges()
    {
        NormalizeTrackedDateTimesToUtc();
        return base.SaveChanges();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        NormalizeTrackedDateTimesToUtc();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        NormalizeTrackedDateTimesToUtc();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        NormalizeTrackedDateTimesToUtc();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Address).IsRequired().HasMaxLength(500);
            entity.Property(e => e.LogoUrl).HasMaxLength(2000);
            entity.Property(e => e.Logo);
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EmployeeCode).IsRequired();
            entity.Property(e => e.FullName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.Phone).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Company).HasMaxLength(200);
            entity.Property(e => e.CompanyId);
            entity.Property(e => e.Department).HasMaxLength(100);
            entity.Property(e => e.DepartmentId);
            entity.Property(e => e.Designation).HasMaxLength(100);
            entity.Property(e => e.DesignationId);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.FatherName).HasMaxLength(200);
            entity.Property(e => e.MotherName).HasMaxLength(200);
            entity.Property(e => e.SpouseName).HasMaxLength(200);
            entity.Property(e => e.FatherPhone).HasMaxLength(50);
            entity.Property(e => e.MotherPhone).HasMaxLength(50);
            entity.Property(e => e.SpousePhone).HasMaxLength(50);
            entity.Property(e => e.Gender).HasMaxLength(50);
            entity.Property(e => e.Religion).HasMaxLength(100);
            entity.Property(e => e.MaritalStatus).HasMaxLength(50);
            entity.Property(e => e.BloodGroup).HasMaxLength(20);
            entity.Property(e => e.NationalId).HasMaxLength(100);
            entity.Property(e => e.EmploymentStatus).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Photo);
            entity.Property(e => e.Signature);
            entity.Property(e => e.WorkingTime).HasMaxLength(100);
            entity.Property(e => e.ShiftId);
            entity.Property(e => e.SalaryRule).HasMaxLength(150);
            entity.Property(e => e.GrossSalary).HasColumnType("numeric(18,2)");
            entity.Property(e => e.BasicSalary).HasColumnType("numeric(18,2)");
            entity.Property(e => e.Weekend).HasMaxLength(100);
            entity.Property(e => e.SalaryAccount).HasMaxLength(100);
            entity.Property(e => e.DateOfBirth);
            entity.Property(e => e.JoiningDate).IsRequired();
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasIndex(e => e.EmployeeCode).IsUnique();
            entity.HasIndex(e => e.CompanyId);
            entity.HasIndex(e => e.DepartmentId);
            entity.HasIndex(e => e.DesignationId);
            entity.HasIndex(e => e.ShiftId);
            entity.HasOne(e => e.CompanyLookup)
                .WithMany()
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.DepartmentLookup)
                .WithMany()
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.DesignationLookup)
                .WithMany()
                .HasForeignKey(e => e.DesignationId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.ShiftLookup)
                .WithMany()
                .HasForeignKey(e => e.ShiftId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Authorizer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Designation).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DesignationId);
            entity.Property(e => e.Department).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DepartmentId);
            entity.Property(e => e.Photo);
            entity.Property(e => e.Signature);
            entity.Property(e => e.PinPassword).IsRequired().HasMaxLength(200);
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.DepartmentId);
            entity.HasIndex(e => e.DesignationId);
            entity.HasOne(e => e.DepartmentLookup)
                .WithMany()
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.DesignationLookup)
                .WithMany()
                .HasForeignKey(e => e.DesignationId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EmployeeCode).IsRequired();
            entity.Property(e => e.PunchTime).IsRequired();
            entity.Property(e => e.AttendanceDate).IsRequired();
            entity.Property(e => e.SourceType).IsRequired().HasMaxLength(30);
            entity.Property(e => e.SourceFileName).IsRequired().HasMaxLength(260);
            entity.Property(e => e.DeviceEmployeeCode).HasMaxLength(100);
            entity.Property(e => e.Remarks).HasMaxLength(200);
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasIndex(e => new { e.EmployeeCode, e.PunchTime }).IsUnique();
            entity.HasIndex(e => e.AttendanceDate);
            entity.HasIndex(e => e.SourceType);
        });

        modelBuilder.Entity<AttendanceRawData>(entity =>
        {
            entity.ToTable("AttendanceRawDataItems");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UploadBatchId).IsRequired();
            entity.Property(e => e.SourceType).IsRequired().HasMaxLength(30);
            entity.Property(e => e.SourceFileName).IsRequired().HasMaxLength(260);
            entity.Property(e => e.DeviceEmployeeCode).HasMaxLength(100);
            entity.Property(e => e.RawPayload).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.HasIndex(e => e.UploadBatchId);
            entity.HasIndex(e => e.PunchTime);
            entity.HasIndex(e => e.SourceType);
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<Designation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
        });

        modelBuilder.Entity<SalaryRule>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.RuleName).IsRequired().HasMaxLength(150);
            entity.Property(e => e.BasicSalary).HasColumnType("numeric(18,2)");
            entity.Property(e => e.HouseRent).HasColumnType("numeric(18,2)");
            entity.Property(e => e.MedicalBill).HasColumnType("numeric(18,2)");
            entity.Property(e => e.TransportBill).HasColumnType("numeric(18,2)");
            entity.Property(e => e.FoodAllowance).HasColumnType("numeric(18,2)");
            entity.Property(e => e.DynamicAttributes).HasColumnType("jsonb");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasIndex(e => e.RuleName).IsUnique();
        });

        modelBuilder.Entity<Shift>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(150);
            entity.Property(e => e.InTime).HasColumnType("time without time zone");
            entity.Property(e => e.OutTime).HasColumnType("time without time zone");
            entity.Property(e => e.InTimeGrace).HasColumnType("time without time zone");
            entity.Property(e => e.OutTimeGrace).HasColumnType("time without time zone");
            entity.Property(e => e.BreakStartTime).HasColumnType("time without time zone");
            entity.Property(e => e.BreakEndTime).HasColumnType("time without time zone");
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasMany(e => e.TemporaryOverrides)
                .WithOne(x => x.Shift)
                .HasForeignKey(x => x.ShiftId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShiftTemporaryOverride>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DateFrom).IsRequired();
            entity.Property(e => e.DateTo).IsRequired();
            entity.Property(e => e.InTime).HasColumnType("time without time zone");
            entity.Property(e => e.OutTime).HasColumnType("time without time zone");
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.CreatedAtUtc).IsRequired();
            entity.Property(e => e.UpdatedAtUtc).IsRequired();
            entity.HasIndex(e => e.ShiftId);
            entity.HasIndex(e => new { e.ShiftId, e.DateFrom, e.DateTo });
        });
    }

    private void NormalizeTrackedDateTimesToUtc()
    {
        var entries = ChangeTracker.Entries()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified);

        foreach (var entry in entries)
        {
            foreach (var property in entry.Properties)
            {
                var clrType = property.Metadata.ClrType;
                if (clrType == typeof(DateTime))
                {
                    if (property.CurrentValue is DateTime dt)
                    {
                        property.CurrentValue = NormalizeToUtc(dt);
                    }
                }
                else if (clrType == typeof(DateTime?))
                {
                    if (property.CurrentValue is DateTime nullableDt)
                    {
                        property.CurrentValue = NormalizeToUtc(nullableDt);
                    }
                }
            }
        }
    }

    private static DateTime NormalizeToUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

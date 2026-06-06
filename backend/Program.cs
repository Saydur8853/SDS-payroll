using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Payroll.Api.Configuration;
using Payroll.Api.Controllers;
using Payroll.Api.Data;

DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 600_000_000;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("DefaultConnection is not configured.");

var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.EnableDynamicJson();
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(dataSource));
builder.Services.AddTransient<EmployeesController>();
builder.Services.AddHangfire(configuration => configuration
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseStaticFiles();
app.MapHangfireDashboard("/hangfire");
app.MapGet("/", () => Results.Redirect("/swagger/index.html"));
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Employees" (
            "Id" uuid NOT NULL,
            "EmployeeCode" bigint NOT NULL,
            "FullName" character varying(200) NOT NULL,
            "Email" character varying(200) NULL,
            "Phone" character varying(50) NOT NULL,
            "Company" character varying(200) NULL,
            "Department" character varying(100) NULL,
            "Designation" character varying(100) NULL,
            "Address" character varying(500) NULL,
            "FatherName" character varying(200) NULL,
            "MotherName" character varying(200) NULL,
            "SpouseName" character varying(200) NULL,
            "FatherPhone" character varying(50) NULL,
            "MotherPhone" character varying(50) NULL,
            "SpousePhone" character varying(50) NULL,
            "Gender" character varying(50) NULL,
            "Religion" character varying(100) NULL,
            "MaritalStatus" character varying(50) NULL,
            "BloodGroup" character varying(20) NULL,
            "NationalId" character varying(100) NULL,
            "EmploymentStatus" character varying(100) NOT NULL,
            "Photo" bytea NULL,
            "Signature" bytea NULL,
            "WorkingTime" character varying(100) NULL,
            "SalaryRule" character varying(150) NULL,
            "GrossSalary" numeric(18,2) NULL,
            "BasicSalary" numeric(18,2) NULL,
            "Weekend" character varying(100) NULL,
            "SalaryAccount" character varying(100) NULL,
            "DateOfBirth" date NULL,
            "JoiningDate" date NOT NULL,
            "DynamicAttributes" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Employees" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Employees"
        ADD COLUMN IF NOT EXISTS "DateOfBirth" date NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "FatherName" character varying(200) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "MotherName" character varying(200) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SpouseName" character varying(200) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "FatherPhone" character varying(50) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "MotherPhone" character varying(50) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SpousePhone" character varying(50) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Gender" character varying(50) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Religion" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "MaritalStatus" character varying(50) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "BloodGroup" character varying(20) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "NationalId" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "EmploymentStatus" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "PhotoUrl" character varying(2000) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SignatureUrl" character varying(2000) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "WorkingTime" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SalaryRule" character varying(150) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "GrossSalary" numeric(18,2) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "BasicSalary" numeric(18,2) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Weekend" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SalaryAccount" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Company" character varying(200) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "CompanyId" uuid NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "DepartmentId" uuid NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "DesignationId" uuid NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ShiftId" uuid NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Employees" ALTER COLUMN "EmployeeCode" TYPE bigint USING "EmployeeCode"::bigint;
        ALTER TABLE "Employees" ALTER COLUMN "SalaryRule" TYPE character varying(150);
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Employees" DROP COLUMN IF EXISTS "PhotoUrl";
        ALTER TABLE "Employees" DROP COLUMN IF EXISTS "SignatureUrl";
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Photo" bytea NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Signature" bytea NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        UPDATE "Employees" SET "Phone" = '' WHERE "Phone" IS NULL;
        ALTER TABLE "Employees" ALTER COLUMN "Phone" SET NOT NULL;
        UPDATE "Employees" SET "EmploymentStatus" = 'Active' WHERE "EmploymentStatus" IS NULL;
        ALTER TABLE "Employees" ALTER COLUMN "EmploymentStatus" SET NOT NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Employees_EmployeeCode" ON "Employees" ("EmployeeCode");
        CREATE INDEX IF NOT EXISTS "IX_Employees_CompanyId" ON "Employees" ("CompanyId");
        CREATE INDEX IF NOT EXISTS "IX_Employees_DepartmentId" ON "Employees" ("DepartmentId");
        CREATE INDEX IF NOT EXISTS "IX_Employees_DesignationId" ON "Employees" ("DesignationId");
        CREATE INDEX IF NOT EXISTS "IX_Employees_ShiftId" ON "Employees" ("ShiftId");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Departments" (
            "Id" uuid NOT NULL,
            "Name" character varying(150) NOT NULL,
            "DynamicAttributes" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Departments" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Departments" ADD COLUMN IF NOT EXISTS "DynamicAttributes" jsonb NOT NULL DEFAULT '{{}}'::jsonb;
        UPDATE "Departments" SET "DynamicAttributes" = '{{}}'::jsonb WHERE "DynamicAttributes" IS NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Designations" (
            "Id" uuid NOT NULL,
            "Name" character varying(150) NOT NULL,
            "DynamicAttributes" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Designations" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "DynamicAttributes" jsonb NOT NULL DEFAULT '{{}}'::jsonb;
        UPDATE "Designations" SET "DynamicAttributes" = '{{}}'::jsonb WHERE "DynamicAttributes" IS NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "SalaryRules" (
            "Id" uuid NOT NULL,
            "RuleName" character varying(150) NOT NULL,
            "BasicSalary" numeric(18,2) NOT NULL,
            "HouseRent" numeric(18,2) NOT NULL,
            "MedicalBill" numeric(18,2) NOT NULL,
            "TransportBill" numeric(18,2) NOT NULL,
            "FoodAllowance" numeric(18,2) NOT NULL,
            "DynamicAttributes" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_SalaryRules" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "RuleName" character varying(150) NULL;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "BasicSalary" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "HouseRent" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "MedicalBill" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "TransportBill" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "FoodAllowance" numeric(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "DynamicAttributes" jsonb NOT NULL DEFAULT '{{}}'::jsonb;
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW();
        ALTER TABLE "SalaryRules" ADD COLUMN IF NOT EXISTS "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW();
        UPDATE "SalaryRules" SET "RuleName" = CONCAT('Rule-', LEFT("Id"::text, 8)) WHERE "RuleName" IS NULL OR BTRIM("RuleName") = '';
        ALTER TABLE "SalaryRules" ALTER COLUMN "RuleName" SET NOT NULL;
        UPDATE "SalaryRules" SET "DynamicAttributes" = '{{}}'::jsonb WHERE "DynamicAttributes" IS NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_SalaryRules_RuleName" ON "SalaryRules" ("RuleName");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Announcements" (
            "Id" uuid NOT NULL,
            "Title" character varying(200) NOT NULL,
            "Message" character varying(2000) NOT NULL,
            "IsActive" boolean NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Announcements" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "Title" character varying(200) NULL;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "Message" character varying(2000) NULL;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT TRUE;
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "CreatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW();
        ALTER TABLE "Announcements" ADD COLUMN IF NOT EXISTS "UpdatedAtUtc" timestamp with time zone NOT NULL DEFAULT NOW();
        UPDATE "Announcements" SET "Title" = 'Announcement' WHERE "Title" IS NULL OR BTRIM("Title") = '';
        UPDATE "Announcements" SET "Message" = '' WHERE "Message" IS NULL;
        ALTER TABLE "Announcements" ALTER COLUMN "Title" SET NOT NULL;
        ALTER TABLE "Announcements" ALTER COLUMN "Message" SET NOT NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE INDEX IF NOT EXISTS "IX_Announcements_CreatedAtUtc" ON "Announcements" ("CreatedAtUtc");
        CREATE INDEX IF NOT EXISTS "IX_Announcements_IsActive" ON "Announcements" ("IsActive");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Shifts" (
            "Id" uuid NOT NULL,
            "Name" character varying(150) NOT NULL,
            "InTime" time without time zone NULL,
            "OutTime" time without time zone NULL,
            "InTimeGrace" time without time zone NULL,
            "OutTimeGrace" time without time zone NULL,
            "BreakStartTime" time without time zone NULL,
            "BreakEndTime" time without time zone NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Shifts" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "InTime" time without time zone NULL;
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "OutTime" time without time zone NULL;
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "InTimeGrace" time without time zone NULL;
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "OutTimeGrace" time without time zone NULL;
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "BreakStartTime" time without time zone NULL;
        ALTER TABLE "Shifts" ADD COLUMN IF NOT EXISTS "BreakEndTime" time without time zone NULL;
        ALTER TABLE "Shifts" ALTER COLUMN "BreakStartTime" DROP NOT NULL;
        ALTER TABLE "Shifts" ALTER COLUMN "BreakEndTime" DROP NOT NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "ShiftTemporaryOverrides" (
            "Id" uuid NOT NULL,
            "ShiftId" uuid NOT NULL,
            "DateFrom" date NOT NULL,
            "DateTo" date NOT NULL,
            "InTime" time without time zone NULL,
            "OutTime" time without time zone NULL,
            "Reason" character varying(500) NULL,
            "IsActive" boolean NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_ShiftTemporaryOverrides" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_ShiftTemporaryOverrides_Shifts_ShiftId" FOREIGN KEY ("ShiftId") REFERENCES "Shifts" ("Id") ON DELETE CASCADE
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE INDEX IF NOT EXISTS "IX_ShiftTemporaryOverrides_ShiftId" ON "ShiftTemporaryOverrides" ("ShiftId");
        CREATE INDEX IF NOT EXISTS "IX_ShiftTemporaryOverrides_ShiftId_DateFrom_DateTo" ON "ShiftTemporaryOverrides" ("ShiftId", "DateFrom", "DateTo");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Authorizers" (
            "Id" uuid NOT NULL,
            "Name" character varying(200) NOT NULL,
            "Designation" character varying(100) NOT NULL,
            "DesignationId" uuid NULL,
            "Department" character varying(100) NOT NULL,
            "DepartmentId" uuid NULL,
            "Photo" bytea NULL,
            "Signature" bytea NULL,
            "PinPassword" character varying(200) NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Authorizers" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Authorizers" ADD COLUMN IF NOT EXISTS "DesignationId" uuid NULL;
        ALTER TABLE "Authorizers" ADD COLUMN IF NOT EXISTS "DepartmentId" uuid NULL;
        ALTER TABLE "Authorizers" ADD COLUMN IF NOT EXISTS "Photo" bytea NULL;
        ALTER TABLE "Authorizers" ADD COLUMN IF NOT EXISTS "Signature" bytea NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Authorizers_Name" ON "Authorizers" ("Name");
        CREATE INDEX IF NOT EXISTS "IX_Authorizers_DepartmentId" ON "Authorizers" ("DepartmentId");
        CREATE INDEX IF NOT EXISTS "IX_Authorizers_DesignationId" ON "Authorizers" ("DesignationId");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "AttendanceRecords" (
            "Id" uuid NOT NULL,
            "EmployeeCode" bigint NOT NULL,
            "PunchTime" timestamp with time zone NOT NULL,
            "AttendanceDate" date NOT NULL,
            "SourceType" character varying(30) NOT NULL,
            "SourceFileName" character varying(260) NOT NULL,
            "DeviceEmployeeCode" character varying(100) NULL,
            "Remarks" character varying(200) NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_AttendanceRecords" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "AttendanceRecords" ADD COLUMN IF NOT EXISTS "DeviceEmployeeCode" character varying(100) NULL;
        ALTER TABLE "AttendanceRecords" ADD COLUMN IF NOT EXISTS "Remarks" character varying(200) NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_AttendanceRecords_EmployeeCode_PunchTime" ON "AttendanceRecords" ("EmployeeCode", "PunchTime");
        CREATE INDEX IF NOT EXISTS "IX_AttendanceRecords_AttendanceDate" ON "AttendanceRecords" ("AttendanceDate");
        CREATE INDEX IF NOT EXISTS "IX_AttendanceRecords_SourceType" ON "AttendanceRecords" ("SourceType");
        """);
    dbContext.Database.ExecuteSqlRaw("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Employees_Companies_CompanyId'
            ) THEN
                ALTER TABLE "Employees"
                ADD CONSTRAINT "FK_Employees_Companies_CompanyId"
                FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Employees_Departments_DepartmentId'
            ) THEN
                ALTER TABLE "Employees"
                ADD CONSTRAINT "FK_Employees_Departments_DepartmentId"
                FOREIGN KEY ("DepartmentId") REFERENCES "Departments" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Employees_Designations_DesignationId'
            ) THEN
                ALTER TABLE "Employees"
                ADD CONSTRAINT "FK_Employees_Designations_DesignationId"
                FOREIGN KEY ("DesignationId") REFERENCES "Designations" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Employees_Shifts_ShiftId'
            ) THEN
                ALTER TABLE "Employees"
                ADD CONSTRAINT "FK_Employees_Shifts_ShiftId"
                FOREIGN KEY ("ShiftId") REFERENCES "Shifts" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Authorizers_Departments_DepartmentId'
            ) THEN
                ALTER TABLE "Authorizers"
                ADD CONSTRAINT "FK_Authorizers_Departments_DepartmentId"
                FOREIGN KEY ("DepartmentId") REFERENCES "Departments" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'FK_Authorizers_Designations_DesignationId'
            ) THEN
                ALTER TABLE "Authorizers"
                ADD CONSTRAINT "FK_Authorizers_Designations_DesignationId"
                FOREIGN KEY ("DesignationId") REFERENCES "Designations" ("Id") ON DELETE SET NULL;
            END IF;
        END $$;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "Logo" bytea NULL;
        """);

    // Backfill FK columns from existing text values, keeping legacy text columns for compatibility.
    var companies = await dbContext.Companies.AsNoTracking().ToListAsync();
    var departments = await dbContext.Departments.AsNoTracking().ToListAsync();
    var designations = await dbContext.Designations.AsNoTracking().ToListAsync();
    var shifts = await dbContext.Shifts.AsNoTracking().ToListAsync();

    static string NormalizeLookup(string? value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();

    static string BuildShiftDisplayName(string name, TimeOnly? inTime, TimeOnly? outTime)
    {
        if (!inTime.HasValue || !outTime.HasValue)
        {
            return name;
        }

        var start = DateTime.Today.Add(inTime.Value.ToTimeSpan()).ToString("hh:mm tt", System.Globalization.CultureInfo.InvariantCulture);
        var end = DateTime.Today.Add(outTime.Value.ToTimeSpan()).ToString("hh:mm tt", System.Globalization.CultureInfo.InvariantCulture);
        return $"{name} - {start} : {end}";
    }

    var companyByName = companies
        .GroupBy(x => NormalizeLookup(x.Name))
        .Where(g => !string.IsNullOrWhiteSpace(g.Key))
        .ToDictionary(g => g.Key, g => g.First().Id);

    var departmentByName = departments
        .GroupBy(x => NormalizeLookup(x.Name))
        .Where(g => !string.IsNullOrWhiteSpace(g.Key))
        .ToDictionary(g => g.Key, g => g.First().Id);

    var designationByName = designations
        .GroupBy(x => NormalizeLookup(x.Name))
        .Where(g => !string.IsNullOrWhiteSpace(g.Key))
        .ToDictionary(g => g.Key, g => g.First().Id);

    var shiftByKey = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
    foreach (var shift in shifts)
    {
        var normalizedName = NormalizeLookup(shift.Name);
        if (!string.IsNullOrWhiteSpace(normalizedName))
        {
            shiftByKey.TryAdd(normalizedName, shift.Id);
        }

        var normalizedDisplay = NormalizeLookup(BuildShiftDisplayName(shift.Name, shift.InTime, shift.OutTime));
        if (!string.IsNullOrWhiteSpace(normalizedDisplay))
        {
            shiftByKey.TryAdd(normalizedDisplay, shift.Id);
        }
    }

    var employeesToBackfill = await dbContext.Employees
        .Where(x => x.CompanyId == null || x.DepartmentId == null || x.DesignationId == null || x.ShiftId == null)
        .ToListAsync();

    var backfilled = false;
    foreach (var employee in employeesToBackfill)
    {
        if (employee.CompanyId == null)
        {
            var key = NormalizeLookup(employee.Company);
            if (!string.IsNullOrWhiteSpace(key) && companyByName.TryGetValue(key, out var companyId))
            {
                employee.CompanyId = companyId;
                backfilled = true;
            }
        }

        if (employee.DepartmentId == null)
        {
            var key = NormalizeLookup(employee.Department);
            if (!string.IsNullOrWhiteSpace(key) && departmentByName.TryGetValue(key, out var deptId))
            {
                employee.DepartmentId = deptId;
                backfilled = true;
            }
        }

        if (employee.DesignationId == null)
        {
            var key = NormalizeLookup(employee.Designation);
            if (!string.IsNullOrWhiteSpace(key) && designationByName.TryGetValue(key, out var designationId))
            {
                employee.DesignationId = designationId;
                backfilled = true;
            }
        }

        if (employee.ShiftId == null)
        {
            var key = NormalizeLookup(employee.WorkingTime);
            if (!string.IsNullOrWhiteSpace(key) && shiftByKey.TryGetValue(key, out var shiftId))
            {
                employee.ShiftId = shiftId;
                backfilled = true;
            }
        }
    }

    var authorizersToBackfill = await dbContext.Authorizers
        .Where(x => x.DepartmentId == null || x.DesignationId == null)
        .ToListAsync();
    foreach (var authorizer in authorizersToBackfill)
    {
        if (authorizer.DepartmentId == null)
        {
            var key = NormalizeLookup(authorizer.Department);
            if (!string.IsNullOrWhiteSpace(key) && departmentByName.TryGetValue(key, out var departmentId))
            {
                authorizer.DepartmentId = departmentId;
                backfilled = true;
            }
        }

        if (authorizer.DesignationId == null)
        {
            var key = NormalizeLookup(authorizer.Designation);
            if (!string.IsNullOrWhiteSpace(key) && designationByName.TryGetValue(key, out var designationId))
            {
                authorizer.DesignationId = designationId;
                backfilled = true;
            }
        }
    }

    if (backfilled)
    {
        await dbContext.SaveChangesAsync();
    }
}

app.Run();

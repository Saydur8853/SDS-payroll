using Microsoft.EntityFrameworkCore;
using Npgsql;
using Payroll.Api.Configuration;
using Payroll.Api.Data;

DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
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

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseStaticFiles();
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
            "SalaryRule" character varying(100) NULL,
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
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SalaryRule" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "GrossSalary" numeric(18,2) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "BasicSalary" numeric(18,2) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Weekend" character varying(100) NULL;
        ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "SalaryAccount" character varying(100) NULL;
        """);
    dbContext.Database.ExecuteSqlRaw("""
        ALTER TABLE "Employees" ALTER COLUMN "EmployeeCode" TYPE bigint USING "EmployeeCode"::bigint;
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
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Departments" (
            "Id" uuid NOT NULL,
            "Name" character varying(150) NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Departments" PRIMARY KEY ("Id")
        );
        """);
    dbContext.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Designations" (
            "Id" uuid NOT NULL,
            "Name" character varying(150) NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Designations" PRIMARY KEY ("Id")
        );
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
        ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "Logo" bytea NULL;
        """);
}

app.Run();

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
            "EmployeeCode" character varying(50) NOT NULL,
            "FullName" character varying(200) NOT NULL,
            "Email" character varying(200) NULL,
            "Phone" character varying(50) NULL,
            "Department" character varying(100) NULL,
            "Designation" character varying(100) NULL,
            "Address" character varying(500) NULL,
            "JoiningDate" date NOT NULL,
            "DynamicAttributes" jsonb NOT NULL,
            "CreatedAtUtc" timestamp with time zone NOT NULL,
            "UpdatedAtUtc" timestamp with time zone NOT NULL,
            CONSTRAINT "PK_Employees" PRIMARY KEY ("Id")
        );
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
}

app.Run();

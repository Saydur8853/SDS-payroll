using System.Diagnostics;
using System.Net.Sockets;
using System.Runtime.Versioning;
using Microsoft.Extensions.Configuration;
using Microsoft.Win32;
using Npgsql;

namespace Payroll.Api.Configuration;

public static class LocalPostgresBootstrapper
{
    private const int ConnectTimeoutMilliseconds = 800;
    private const int StartupTimeoutMilliseconds = 20_000;

    public static void EnsureStarted(string connectionString, IConfiguration configuration)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var host = builder.Host?.Trim();
        var port = builder.Port > 0 ? builder.Port : 5432;

        if (!IsLocalHost(host) || IsPortOpen(host!, port))
        {
            return;
        }

        if (!OperatingSystem.IsWindows())
        {
            throw BuildUnavailableException(host!, port, "Start PostgreSQL before running the API.");
        }

        var serviceName = configuration["PostgreSql:ServiceName"]?.Trim();
        var candidates = string.IsNullOrWhiteSpace(serviceName)
            ? GetPostgresServiceNames()
            : [serviceName];

        if (candidates.Count == 0)
        {
            throw BuildUnavailableException(host!, port, "No local PostgreSQL Windows service was found.");
        }

        foreach (var candidate in candidates)
        {
            TryStartService(candidate);
            if (WaitForPort(host!, port))
            {
                return;
            }

            TryStartServiceElevated(candidate);
            if (WaitForPort(host!, port))
            {
                return;
            }
        }

        throw BuildUnavailableException(
            host!,
            port,
            $"Could not start PostgreSQL service automatically. If you cancelled the Windows admin prompt, run: Start-Service {candidates[0]}");
    }

    private static bool IsLocalHost(string? host)
    {
        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase);
    }

    private static bool WaitForPort(string host, int port)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(StartupTimeoutMilliseconds);
        while (DateTime.UtcNow < deadline)
        {
            if (IsPortOpen(host, port))
            {
                return true;
            }

            Thread.Sleep(500);
        }

        return false;
    }

    private static bool IsPortOpen(string host, int port)
    {
        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(host, port);
            return connectTask.Wait(ConnectTimeoutMilliseconds) && client.Connected;
        }
        catch
        {
            return false;
        }
    }

    [SupportedOSPlatform("windows")]
    private static List<string> GetPostgresServiceNames()
    {
        using var servicesKey = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services");
        if (servicesKey is null)
        {
            return [];
        }

        return servicesKey.GetSubKeyNames()
            .Where(name => name.StartsWith("postgresql", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static void TryStartService(string serviceName)
    {
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = "sc.exe",
            Arguments = $"start \"{serviceName}\"",
            CreateNoWindow = true,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        });

        process?.WaitForExit(8_000);
    }

    private static void TryStartServiceElevated(string serviceName)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"start \"{serviceName}\"",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden
            });

            process?.WaitForExit(15_000);
        }
        catch
        {
            // The user may cancel the UAC prompt or the environment may not support elevation.
        }
    }

    private static InvalidOperationException BuildUnavailableException(string host, int port, string nextStep)
    {
        return new InvalidOperationException(
            $"PostgreSQL is not reachable at {host}:{port}. {nextStep}");
    }
}

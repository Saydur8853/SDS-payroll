namespace Payroll.Api.Configuration;

public static class DotEnvLoader
{
    public static void Load()
    {
        var envPath = ResolveEnvPath();
        if (envPath is null || !File.Exists(envPath))
        {
            return;
        }

        foreach (var rawLine in File.ReadAllLines(envPath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var value = line[(separatorIndex + 1)..].Trim();
            value = StripQuotes(value);

            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    private static string? ResolveEnvPath()
    {
        var current = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(current, ".env"),
            Path.Combine(current, "backend", ".env"),
            Path.Combine(current, "..", "backend", ".env")
        };

        return candidates.FirstOrDefault(File.Exists);
    }

    private static string StripQuotes(string value)
    {
        if (value.Length >= 2 &&
            ((value.StartsWith('"') && value.EndsWith('"')) ||
             (value.StartsWith('\'') && value.EndsWith('\''))))
        {
            return value[1..^1];
        }

        return value;
    }
}

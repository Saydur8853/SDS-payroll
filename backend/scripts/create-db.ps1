param(
    [Parameter(Mandatory = $true)]
    [string]$Password,
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$UserName = "postgres",
    [string]$DatabaseName = "sds_payroll_api_dev",
    [string]$AdminDatabase = "postgres"
)

$ErrorActionPreference = "Stop"

$env:PGPASSWORD = $Password

try {
    $exists = & psql -h $HostName -p $Port -U $UserName -d $AdminDatabase -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not connect to PostgreSQL with the provided credentials."
    }

    if (($exists | Out-String).Trim() -eq "1") {
        Write-Host "Database '$DatabaseName' already exists."
    }
    else {
        & createdb -h $HostName -p $Port -U $UserName $DatabaseName
        Write-Host "Database '$DatabaseName' created successfully."
    }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

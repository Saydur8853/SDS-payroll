namespace Payroll.Api.Dtos;

public class AttendanceUploadResultResponse
{
    public string SourceType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public int AllowedEmployeeCount { get; set; }
    public int TotalPunchRowsRead { get; set; }
    public int ExistingRowsDeleted { get; set; }
    public int InsertedRows { get; set; }
    public int DuplicateRowsSkipped { get; set; }
    public int InvalidRowsSkipped { get; set; }
    public DateTime? SourceMinPunchTimeUtc { get; set; }
    public DateTime? SourceMaxPunchTimeUtc { get; set; }
}

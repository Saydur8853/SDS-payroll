namespace Payroll.Api.Dtos;

public class AttendanceRawDataUploadResultResponse
{
    public Guid UploadBatchId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public int TotalRowsRead { get; set; }
    public int InsertedRows { get; set; }
    public int InvalidRowsSkipped { get; set; }
    public DateTime? SourceMinPunchTimeUtc { get; set; }
    public DateTime? SourceMaxPunchTimeUtc { get; set; }
}


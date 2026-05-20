export interface AttendanceRawDataRecord {
  id: string;
  uploadBatchId: string;
  sourceType: string;
  sourceFileName: string;
  employeeCode?: number | null;
  deviceEmployeeCode?: string | null;
  punchTime?: string | null;
  rawPayload: Record<string, unknown>;
  createdAtUtc: string;
}

export interface AttendanceRawDataUploadResult {
  uploadBatchId: string;
  sourceType: string;
  fileName: string;
  totalRowsRead: number;
  insertedRows: number;
  invalidRowsSkipped: number;
  sourceMinPunchTimeUtc?: string | null;
  sourceMaxPunchTimeUtc?: string | null;
}

export interface AttendanceRawDataSearchParams {
  page?: number;
  pageSize?: number;
  employeeCode?: string | null;
  sourceType?: string | null;
  uploadBatchId?: string | null;
  fromPunchDate?: string | null;
  toPunchDate?: string | null;
}

export interface AttendanceRawDataDeleteByDateRangeRequest {
  fromPunchDate: string;
  toPunchDate: string;
  employeeCode?: string | null;
}

export interface AttendanceRawDataDeleteByDateRangeResult {
  deletedCount: number;
}

export interface AttendanceRawDataPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

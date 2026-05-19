export interface AttendanceRecord {
  id: string;
  employeeCode: number;
  employeeName?: string | null;
  company?: string | null;
  department?: string | null;
  designation?: string | null;
  punchTime: string;
  attendanceDate: string;
  sourceType: string;
  sourceFileName: string;
  deviceEmployeeCode?: string | null;
  remarks?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AttendanceDailyDetail {
  employeeCode: number;
  employeeName?: string | null;
  company?: string | null;
  department?: string | null;
  designation?: string | null;
  attendanceDate: string;
  inTime: string;
  outTime?: string | null;
  punchCount: number;
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  earlyOutMinutes?: number | null;
  status: string;
  shiftName?: string | null;
  shiftDisplayName?: string | null;
  sourceType: string;
  sourceFileName: string;
}

export interface AttendanceSearchParams {
  page?: number;
  pageSize?: number;
  search?: string | null;
  employeeCode?: number | null;
  sourceType?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  company?: string | null;
  department?: string | null;
  designation?: string | null;
}

export interface AttendancePagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AttendanceUploadResult {
  sourceType: string;
  fileName: string;
  fromDate: string;
  toDate: string;
  allowedEmployeeCount: number;
  totalPunchRowsRead: number;
  existingRowsDeleted: number;
  insertedRows: number;
  duplicateRowsSkipped: number;
  invalidRowsSkipped: number;
  sourceMinPunchTimeUtc?: string | null;
  sourceMaxPunchTimeUtc?: string | null;
}

export interface AttendanceUpdateRequest {
  employeeCode: number;
  punchTime: string;
  remarks?: string | null;
}

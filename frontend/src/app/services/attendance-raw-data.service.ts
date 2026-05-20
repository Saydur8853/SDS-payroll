import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AttendanceRawDataDeleteByDateRangeRequest,
  AttendanceRawDataDeleteByDateRangeResult,
  AttendanceRawDataPagedResponse,
  AttendanceRawDataRecord,
  AttendanceRawDataSearchParams,
  AttendanceRawDataUploadResult
} from '../models/attendance-raw-data.model';

@Injectable({
  providedIn: 'root'
})
export class AttendanceRawDataService {
  private readonly apiUrl = 'http://localhost:5277/api/AttendanceRawData';

  constructor(private readonly http: HttpClient) {}

  getAll(params: AttendanceRawDataSearchParams): Observable<AttendanceRawDataPagedResponse<AttendanceRawDataRecord>> {
    const queryParams: Record<string, string> = {
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 100)
    };

    if (params.employeeCode?.trim()) queryParams['employeeCode'] = params.employeeCode.trim();
    if (params.sourceType?.trim()) queryParams['sourceType'] = params.sourceType.trim();
    if (params.uploadBatchId?.trim()) queryParams['uploadBatchId'] = params.uploadBatchId.trim();
    if (params.fromPunchDate?.trim()) queryParams['fromPunchDate'] = params.fromPunchDate.trim();
    if (params.toPunchDate?.trim()) queryParams['toPunchDate'] = params.toPunchDate.trim();

    return this.http.get<AttendanceRawDataPagedResponse<AttendanceRawDataRecord>>(this.apiUrl, { params: queryParams });
  }

  uploadMdb(request: { file: File }): Observable<HttpEvent<AttendanceRawDataUploadResult>> {
    const formData = new FormData();
    formData.append('file', request.file);

    return this.http.post<AttendanceRawDataUploadResult>(`${this.apiUrl}/upload-mdb`, formData, {
      observe: 'events',
      reportProgress: true
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  deleteByDateRange(request: AttendanceRawDataDeleteByDateRangeRequest): Observable<AttendanceRawDataDeleteByDateRangeResult> {
    const queryParams: Record<string, string> = {
      fromPunchDate: request.fromPunchDate,
      toPunchDate: request.toPunchDate
    };

    if (request.employeeCode?.trim()) {
      queryParams['employeeCode'] = request.employeeCode.trim();
    }

    return this.http.delete<AttendanceRawDataDeleteByDateRangeResult>(`${this.apiUrl}/by-date-range`, { params: queryParams });
  }
}

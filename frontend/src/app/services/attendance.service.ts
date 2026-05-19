import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AttendanceDailyDetail,
  AttendancePagedResponse,
  AttendanceRecord,
  AttendanceSearchParams,
  AttendanceUpdateRequest,
  AttendanceUploadResult
} from '../models/attendance.model';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly apiUrl = 'http://localhost:5277/api/attendance';

  constructor(private readonly http: HttpClient) {}

  getAll(params: AttendanceSearchParams): Observable<AttendancePagedResponse<AttendanceRecord>> {
    const queryParams = this.buildSearchQueryParams(params);
    return this.http.get<AttendancePagedResponse<AttendanceRecord>>(this.apiUrl, { params: queryParams });
  }

  getDetails(params: AttendanceSearchParams): Observable<AttendancePagedResponse<AttendanceDailyDetail>> {
    const queryParams = this.buildSearchQueryParams(params);
    return this.http.get<AttendancePagedResponse<AttendanceDailyDetail>>(`${this.apiUrl}/details`, { params: queryParams });
  }

  private buildSearchQueryParams(params: AttendanceSearchParams): Record<string, string> {
    const queryParams: Record<string, string> = {
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 50)
    };

    if (params.search?.trim()) queryParams['search'] = params.search.trim();
    if (params.employeeCode !== null && params.employeeCode !== undefined) queryParams['employeeCode'] = String(params.employeeCode);
    if (params.sourceType?.trim()) queryParams['sourceType'] = params.sourceType.trim();
    if (params.fromDate?.trim()) queryParams['fromDate'] = params.fromDate.trim();
    if (params.toDate?.trim()) queryParams['toDate'] = params.toDate.trim();
    if (params.company?.trim()) queryParams['company'] = params.company.trim();
    if (params.department?.trim()) queryParams['department'] = params.department.trim();
    if (params.designation?.trim()) queryParams['designation'] = params.designation.trim();
    return queryParams;
  }

  uploadMdb(request: {
    file: File;
    sourceType?: string | null;
    fromDate: string;
    toDate: string;
    replaceExisting: boolean;
    company?: string | null;
    department?: string | null;
    designation?: string | null;
    employeeCodesCsv?: string | null;
  }): Observable<HttpEvent<AttendanceUploadResult>> {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('fromDate', request.fromDate);
    formData.append('toDate', request.toDate);
    formData.append('replaceExisting', String(request.replaceExisting));

    if (request.sourceType?.trim()) formData.append('sourceType', request.sourceType.trim());
    if (request.company?.trim()) formData.append('company', request.company.trim());
    if (request.department?.trim()) formData.append('department', request.department.trim());
    if (request.designation?.trim()) formData.append('designation', request.designation.trim());
    if (request.employeeCodesCsv?.trim()) formData.append('employeeCodesCsv', request.employeeCodesCsv.trim());

    return this.http.post<AttendanceUploadResult>(`${this.apiUrl}/upload-mdb`, formData, {
      observe: 'events',
      reportProgress: true
    });
  }

  update(id: string, request: AttendanceUpdateRequest): Observable<AttendanceRecord> {
    return this.http.put<AttendanceRecord>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

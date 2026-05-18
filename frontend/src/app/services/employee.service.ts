import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEmployeeRequest, Employee, EmployeeSearchParams, PagedResponse } from '../models/employee.model';

export interface EmployeeCsvImportResult {
  message: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: string[];
}

export interface EmployeeCsvImportJobAccepted {
  jobId: string;
  hangfireJobId?: string | null;
  status: 'Queued' | string;
  message: string;
}

export interface EmployeeCsvImportJobStatus {
  jobId: string;
  hangfireJobId?: string | null;
  status: 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Canceled' | string;
  cancellationRequested?: boolean;
  message: string;
  createdAtUtc: string;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  updatedAtUtc: string;
  totalRows?: number | null;
  processedRows?: number | null;
  progressPercent?: number | null;
  result?: EmployeeCsvImportResult | null;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly apiUrl = 'http://localhost:5277/api/employees';

  constructor(private readonly http: HttpClient) {}

  getAll(params: EmployeeSearchParams): Observable<PagedResponse<Employee>> {
    const queryParams: Record<string, string> = {
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 20)
    };

    if (params.search?.trim()) {
      queryParams['search'] = params.search.trim();
    }
    if (params.employeeCode !== null && params.employeeCode !== undefined) {
      queryParams['employeeCode'] = String(params.employeeCode);
    }
    if (params.phone?.trim()) {
      queryParams['phone'] = params.phone.trim();
    }
    if (params.nationalId?.trim()) {
      queryParams['nationalId'] = params.nationalId.trim();
    }
    if (params.company?.trim()) {
      queryParams['company'] = params.company.trim();
    }
    if (params.department?.trim()) {
      queryParams['department'] = params.department.trim();
    }
    if (params.designation?.trim()) {
      queryParams['designation'] = params.designation.trim();
    }
    if (params.employmentStatus?.trim()) {
      queryParams['employmentStatus'] = params.employmentStatus.trim();
    }
    if (params.gender?.trim()) {
      queryParams['gender'] = params.gender.trim();
    }
    if (params.religion?.trim()) {
      queryParams['religion'] = params.religion.trim();
    }
    if (params.maritalStatus?.trim()) {
      queryParams['maritalStatus'] = params.maritalStatus.trim();
    }
    if (params.bloodGroup?.trim()) {
      queryParams['bloodGroup'] = params.bloodGroup.trim();
    }
    if (params.workingTime?.trim()) {
      queryParams['workingTime'] = params.workingTime.trim();
    }
    if (params.salaryRule?.trim()) {
      queryParams['salaryRule'] = params.salaryRule.trim();
    }
    if (params.weekend?.trim()) {
      queryParams['weekend'] = params.weekend.trim();
    }
    if (params.salaryAccount?.trim()) {
      queryParams['salaryAccount'] = params.salaryAccount.trim();
    }
    if (params.dateOfBirthFrom?.trim()) {
      queryParams['dateOfBirthFrom'] = params.dateOfBirthFrom.trim();
    }
    if (params.dateOfBirthTo?.trim()) {
      queryParams['dateOfBirthTo'] = params.dateOfBirthTo.trim();
    }
    if (params.joiningDateFrom?.trim()) {
      queryParams['joiningDateFrom'] = params.joiningDateFrom.trim();
    }
    if (params.joiningDateTo?.trim()) {
      queryParams['joiningDateTo'] = params.joiningDateTo.trim();
    }

    return this.http.get<PagedResponse<Employee>>(this.apiUrl, { params: queryParams });
  }

  export(params: EmployeeSearchParams): Observable<Blob> {
    const queryParams: Record<string, string> = {};

    if (params.search?.trim()) {
      queryParams['search'] = params.search.trim();
    }
    if (params.employeeCode !== null && params.employeeCode !== undefined) {
      queryParams['employeeCode'] = String(params.employeeCode);
    }
    if (params.phone?.trim()) {
      queryParams['phone'] = params.phone.trim();
    }
    if (params.nationalId?.trim()) {
      queryParams['nationalId'] = params.nationalId.trim();
    }
    if (params.company?.trim()) {
      queryParams['company'] = params.company.trim();
    }
    if (params.department?.trim()) {
      queryParams['department'] = params.department.trim();
    }
    if (params.designation?.trim()) {
      queryParams['designation'] = params.designation.trim();
    }
    if (params.employmentStatus?.trim()) {
      queryParams['employmentStatus'] = params.employmentStatus.trim();
    }
    if (params.gender?.trim()) {
      queryParams['gender'] = params.gender.trim();
    }
    if (params.religion?.trim()) {
      queryParams['religion'] = params.religion.trim();
    }
    if (params.maritalStatus?.trim()) {
      queryParams['maritalStatus'] = params.maritalStatus.trim();
    }
    if (params.bloodGroup?.trim()) {
      queryParams['bloodGroup'] = params.bloodGroup.trim();
    }
    if (params.workingTime?.trim()) {
      queryParams['workingTime'] = params.workingTime.trim();
    }
    if (params.salaryRule?.trim()) {
      queryParams['salaryRule'] = params.salaryRule.trim();
    }
    if (params.weekend?.trim()) {
      queryParams['weekend'] = params.weekend.trim();
    }
    if (params.salaryAccount?.trim()) {
      queryParams['salaryAccount'] = params.salaryAccount.trim();
    }
    if (params.dateOfBirthFrom?.trim()) {
      queryParams['dateOfBirthFrom'] = params.dateOfBirthFrom.trim();
    }
    if (params.dateOfBirthTo?.trim()) {
      queryParams['dateOfBirthTo'] = params.dateOfBirthTo.trim();
    }
    if (params.joiningDateFrom?.trim()) {
      queryParams['joiningDateFrom'] = params.joiningDateFrom.trim();
    }
    if (params.joiningDateTo?.trim()) {
      queryParams['joiningDateTo'] = params.joiningDateTo.trim();
    }

    return this.http.get(`${this.apiUrl}/export`, {
      params: queryParams,
      responseType: 'blob'
    });
  }

  importUpdateCsv(file: File): Observable<EmployeeCsvImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<EmployeeCsvImportResult>(
      `${this.apiUrl}/import-update`,
      formData
    );
  }

  importUpdateCsvInBackground(file: File): Observable<EmployeeCsvImportJobAccepted> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<EmployeeCsvImportJobAccepted>(`${this.apiUrl}/import-update/background`, formData);
  }

  getImportUpdateCsvJobStatus(jobId: string): Observable<EmployeeCsvImportJobStatus> {
    return this.http.get<EmployeeCsvImportJobStatus>(`${this.apiUrl}/import-update/jobs/${jobId}`);
  }

  cancelImportUpdateCsvJob(jobId: string): Observable<EmployeeCsvImportJobStatus> {
    return this.http.post<EmployeeCsvImportJobStatus>(`${this.apiUrl}/import-update/jobs/${jobId}/cancel`, {});
  }

  getAttributeSuggestions(query: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/attribute-suggestions`, {
      params: { query, take: '8' }
    });
  }

  getStatusOptions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/status-options`);
  }

  create(request: CreateEmployeeRequest): Observable<Employee> {
    return this.http.post<Employee>(this.apiUrl, request);
  }

  update(id: string, request: Omit<CreateEmployeeRequest, 'dynamicAttributes'>): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/${id}`, request);
  }

  replaceDynamicAttributes(id: string, dynamicAttributes: Record<string, string | null>): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/${id}/attributes`, { dynamicAttributes });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  checkEmployeeCode(code: number, excludeId?: string): Observable<boolean> {
    let url = `${this.apiUrl}/exists/${code}`;
    if (excludeId) {
      url += `?excludeId=${excludeId}`;
    }
    return this.http.get<boolean>(url);
  }
}

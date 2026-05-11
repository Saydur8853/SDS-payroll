import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEmployeeRequest, Employee, EmployeeSearchParams, PagedResponse } from '../models/employee.model';

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
    if (params.department?.trim()) {
      queryParams['department'] = params.department.trim();
    }
    if (params.designation?.trim()) {
      queryParams['designation'] = params.designation.trim();
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
    if (params.department?.trim()) {
      queryParams['department'] = params.department.trim();
    }
    if (params.designation?.trim()) {
      queryParams['designation'] = params.designation.trim();
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
}

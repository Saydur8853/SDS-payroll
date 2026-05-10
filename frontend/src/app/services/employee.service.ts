import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEmployeeRequest, Employee } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly apiUrl = 'http://localhost:5277/api/employees';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.apiUrl);
  }

  getAttributeSuggestions(query: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/attribute-suggestions`, {
      params: { query, take: '8' }
    });
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

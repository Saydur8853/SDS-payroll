import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LookupItem } from '../models/lookup.model';

@Injectable({
  providedIn: 'root'
})
export class LookupService {
  private readonly departmentApi = 'http://localhost:5277/api/departments';
  private readonly designationApi = 'http://localhost:5277/api/designations';
  private readonly shiftLookupApi = 'http://localhost:5277/api/shifts/lookup';

  constructor(private readonly http: HttpClient) {}

  getDepartments(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(this.departmentApi);
  }

  createDepartment(name: string, dynamicAttributes: Record<string, string> = {}): Observable<LookupItem> {
    return this.http.post<LookupItem>(this.departmentApi, { name, dynamicAttributes });
  }

  updateDepartment(id: string, name: string, dynamicAttributes: Record<string, string> = {}): Observable<LookupItem> {
    return this.http.put<LookupItem>(`${this.departmentApi}/${id}`, { name, dynamicAttributes });
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.departmentApi}/${id}`);
  }

  getDesignations(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(this.designationApi);
  }

  createDesignation(name: string, dynamicAttributes: Record<string, string> = {}): Observable<LookupItem> {
    return this.http.post<LookupItem>(this.designationApi, { name, dynamicAttributes });
  }

  updateDesignation(id: string, name: string, dynamicAttributes: Record<string, string> = {}): Observable<LookupItem> {
    return this.http.put<LookupItem>(`${this.designationApi}/${id}`, { name, dynamicAttributes });
  }

  deleteDesignation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.designationApi}/${id}`);
  }

  getShifts(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(this.shiftLookupApi);
  }
}

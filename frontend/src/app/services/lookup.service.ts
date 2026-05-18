import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LookupItem } from '../models/lookup.model';

export interface DesignationUsageEmployee {
  id: string;
  employeeCode: number;
  fullName: string;
}

export interface DesignationUsageResponse {
  designationId: string;
  designationName: string;
  employeeCount: number;
  employees: DesignationUsageEmployee[];
}

export interface DepartmentUsageEmployee {
  id: string;
  employeeCode: number;
  fullName: string;
}

export interface DepartmentUsageResponse {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  employees: DepartmentUsageEmployee[];
}

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

  getDepartmentUsage(id: string): Observable<DepartmentUsageResponse> {
    return this.http.get<DepartmentUsageResponse>(`${this.departmentApi}/${id}/usage`);
  }

  moveDepartmentEmployees(
    sourceDepartmentId: string,
    targetDepartmentId: string,
    deleteSourceDepartmentAfterMove = true,
    employeeIds?: string[]
  ): Observable<{ movedCount: number; sourceDeleted: boolean }> {
    return this.http.post<{ movedCount: number; sourceDeleted: boolean }>(
      `${this.departmentApi}/${sourceDepartmentId}/move-employees`,
      {
        targetDepartmentId,
        deleteSourceDepartmentAfterMove,
        employeeIds
      }
    );
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

  getDesignationUsage(id: string): Observable<DesignationUsageResponse> {
    return this.http.get<DesignationUsageResponse>(`${this.designationApi}/${id}/usage`);
  }

  moveDesignationEmployees(
    sourceDesignationId: string,
    targetDesignationId: string,
    deleteSourceDesignationAfterMove = true,
    employeeIds?: string[]
  ): Observable<{ movedCount: number; sourceDeleted: boolean }> {
    return this.http.post<{ movedCount: number; sourceDeleted: boolean }>(
      `${this.designationApi}/${sourceDesignationId}/move-employees`,
      {
        targetDesignationId,
        deleteSourceDesignationAfterMove,
        employeeIds
      }
    );
  }

  getShifts(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(this.shiftLookupApi);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Shift, ShiftTemporaryOverride, ShiftTemporaryOverrideUpsertRequest, ShiftUpsertRequest } from '../models/shift.model';

export interface ShiftUsageEmployee {
  id: string;
  employeeCode: number;
  fullName: string;
}

export interface ShiftUsageResponse {
  shiftId: string;
  shiftName: string;
  shiftDisplayName: string;
  employeeCount: number;
  employees: ShiftUsageEmployee[];
}

@Injectable({
  providedIn: 'root'
})
export class ShiftService {
  private readonly apiUrl = 'http://localhost:5277/api/shifts';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Shift[]> {
    return this.http.get<Shift[]>(this.apiUrl);
  }

  create(request: ShiftUpsertRequest): Observable<Shift> {
    return this.http.post<Shift>(this.apiUrl, request);
  }

  update(id: string, request: ShiftUpsertRequest): Observable<Shift> {
    return this.http.put<Shift>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getUsage(shiftId: string): Observable<ShiftUsageResponse> {
    return this.http.get<ShiftUsageResponse>(`${this.apiUrl}/${shiftId}/usage`);
  }

  moveEmployees(
    sourceShiftId: string,
    targetShiftId: string,
    deleteSourceShiftAfterMove = true,
    employeeIds?: string[]
  ): Observable<{ movedCount: number; sourceDeleted: boolean }> {
    return this.http.post<{ movedCount: number; sourceDeleted: boolean }>(
      `${this.apiUrl}/${sourceShiftId}/move-employees`,
      {
        targetShiftId,
        deleteSourceShiftAfterMove,
        employeeIds
      }
    );
  }

  getOverrides(shiftId: string): Observable<ShiftTemporaryOverride[]> {
    return this.http.get<ShiftTemporaryOverride[]>(`${this.apiUrl}/${shiftId}/overrides`);
  }

  createOverride(shiftId: string, request: ShiftTemporaryOverrideUpsertRequest): Observable<ShiftTemporaryOverride> {
    return this.http.post<ShiftTemporaryOverride>(`${this.apiUrl}/${shiftId}/overrides`, request);
  }

  updateOverride(shiftId: string, overrideId: string, request: ShiftTemporaryOverrideUpsertRequest): Observable<ShiftTemporaryOverride> {
    return this.http.put<ShiftTemporaryOverride>(`${this.apiUrl}/${shiftId}/overrides/${overrideId}`, request);
  }

  deleteOverride(shiftId: string, overrideId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${shiftId}/overrides/${overrideId}`);
  }
}

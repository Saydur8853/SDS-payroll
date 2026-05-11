import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Shift, ShiftUpsertRequest } from '../models/shift.model';

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
}

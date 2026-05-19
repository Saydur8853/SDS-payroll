import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SalaryRule, SalaryRuleUpsertRequest } from '../models/salary-rule.model';

@Injectable({
  providedIn: 'root'
})
export class SalaryRuleService {
  private readonly apiUrl = 'http://localhost:5277/api/salaryrules';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<SalaryRule[]> {
    return this.http.get<SalaryRule[]>(this.apiUrl);
  }

  create(request: SalaryRuleUpsertRequest): Observable<SalaryRule> {
    return this.http.post<SalaryRule>(this.apiUrl, request);
  }

  update(id: string, request: SalaryRuleUpsertRequest): Observable<SalaryRule> {
    return this.http.put<SalaryRule>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

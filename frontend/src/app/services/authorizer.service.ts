import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Authorizer, CreateAuthorizerRequest } from '../models/authorizer.model';

@Injectable({
  providedIn: 'root'
})
export class AuthorizerService {
  private readonly apiUrl = 'http://localhost:5277/api/authorizers';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Authorizer[]> {
    return this.http.get<Authorizer[]>(this.apiUrl);
  }

  create(request: CreateAuthorizerRequest): Observable<Authorizer> {
    return this.http.post<Authorizer>(this.apiUrl, request);
  }

  update(id: string, request: CreateAuthorizerRequest): Observable<Authorizer> {
    return this.http.put<Authorizer>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

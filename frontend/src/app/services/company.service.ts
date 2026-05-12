import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Company, CreateCompanyRequest } from '../models/company.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  // Update this URL if your backend runs on another port.
  private readonly apiUrl = 'http://localhost:5277/api/companies';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Company[]> {
    return this.http.get<Company[]>(this.apiUrl);
  }

  getAttributeSuggestions(query: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}/attribute-suggestions`,
      { params: { query, take: '8' } }
    );
  }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.http.post<Company>(this.apiUrl, request);
  }

  update(id: string, request: { name: string; address: string; logoUrl?: string | null; logoBase64?: string | null }): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}`, request);
  }

  upsertDynamicAttribute(id: string, key: string, value: string): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}/attributes/${encodeURIComponent(key)}`, { value });
  }

  replaceDynamicAttributes(id: string, dynamicAttributes: Record<string, string | null>): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}/attributes`, { dynamicAttributes });
  }

  deleteDynamicAttribute(id: string, key: string): Observable<Company> {
    return this.http.delete<Company>(`${this.apiUrl}/${id}/attributes/${encodeURIComponent(key)}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  createWithLogoUpload(
    name: string,
    address: string,
    dynamicAttributes: Record<string, string | null>,
    file: File
  ): Observable<Company> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('address', address);
    formData.append('dynamicAttributesJson', JSON.stringify(dynamicAttributes));
    formData.append('logoFile', file);
    return this.http.post<Company>(`${this.apiUrl}/with-logo-upload`, formData);
  }
}

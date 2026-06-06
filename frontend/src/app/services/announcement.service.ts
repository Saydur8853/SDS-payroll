import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Announcement, AnnouncementUpsertRequest } from '../models/announcement.model';

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private readonly apiUrl = 'http://localhost:5277/api/announcements';
  private readonly changedSubject = new Subject<void>();

  readonly changed$ = this.changedSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  getAll(includeInactive = false): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(this.apiUrl, {
      params: { includeInactive: String(includeInactive) }
    });
  }

  create(request: AnnouncementUpsertRequest): Observable<Announcement> {
    return this.http.post<Announcement>(this.apiUrl, request);
  }

  update(id: string, request: AnnouncementUpsertRequest): Observable<Announcement> {
    return this.http.put<Announcement>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  notifyChanged(): void {
    this.changedSubject.next();
  }
}

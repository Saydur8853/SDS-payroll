import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import {
  AttendanceRawDataRecord
} from '../../models/attendance-raw-data.model';
import { AttendanceRawDataService } from '../../services/attendance-raw-data.service';

@Component({
  selector: 'app-attendance-raw-data',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-raw-data.component.html',
  styleUrl: './attendance-raw-data.component.scss'
})
export class AttendanceRawDataComponent implements OnInit {
  uploadFile: File | null = null;
  uploading = false;
  uploadProgressPercent = 0;
  uploadProgressLabel = '';

  items: AttendanceRawDataRecord[] = [];
  loading = false;
  message = '';
  deletingRange = false;

  filterEmployeeCode = '';
  filterSourceType = '';
  filterFromPunchDate = '';
  filterToPunchDate = '';

  page = 1;
  pageSize = 100;
  totalCount = 0;
  totalPages = 0;
  readonly pageSizeOptions = [50, 100, 200, 500];

  constructor(private readonly attendanceRawDataService: AttendanceRawDataService) {}

  ngOnInit(): void {
    this.loadRawData();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
  }

  uploadMdb(): void {
    if (!this.uploadFile) {
      this.message = 'Please select an MDB file.';
      return;
    }

    if (!this.uploadFile.name.toLowerCase().endsWith('.mdb')) {
      this.message = 'Only .mdb files are supported.';
      return;
    }

    this.uploading = true;
    this.uploadProgressPercent = 0;
    this.uploadProgressLabel = 'Starting upload...';

    this.attendanceRawDataService.uploadMdb({
      file: this.uploadFile
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Sent) {
          this.uploadProgressPercent = 0;
          this.uploadProgressLabel = 'Upload started...';
          return;
        }

        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? this.uploadFile?.size ?? 0;
          if (total > 0) {
            this.uploadProgressPercent = Math.min(100, Math.round((event.loaded / total) * 100));
            this.uploadProgressLabel = `Uploading... ${this.uploadProgressPercent}%`;
          } else {
            this.uploadProgressLabel = 'Uploading...';
          }
          return;
        }

        if (event.type === HttpEventType.Response && event.body) {
          const result = event.body;
          this.message = `Raw upload complete. Batch: ${result.uploadBatchId}, rows: ${result.totalRowsRead}, inserted: ${result.insertedRows}, invalid: ${result.invalidRowsSkipped}.`;
          this.page = 1;
          this.loadRawData();
        }
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to upload raw MDB.';
      },
      complete: () => {
        this.uploading = false;
        this.uploadProgressPercent = 0;
        this.uploadProgressLabel = '';
      }
    });
  }

  loadRawData(): void {
    this.loading = true;
    this.attendanceRawDataService.getAll({
      page: this.page,
      pageSize: this.pageSize,
      employeeCode: this.filterEmployeeCode,
      sourceType: this.filterSourceType || null,
      fromPunchDate: this.filterFromPunchDate || null,
      toPunchDate: this.filterToPunchDate || null
    }).subscribe({
      next: (response) => {
        this.items = response.items;
        this.totalCount = response.totalCount;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalPages = response.totalPages;
      },
      error: () => {
        this.message = 'Failed to load attendance raw data.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadRawData();
  }

  resetFilters(): void {
    this.filterEmployeeCode = '';
    this.filterSourceType = '';
    this.filterFromPunchDate = '';
    this.filterToPunchDate = '';
    this.page = 1;
    this.loadRawData();
  }

  onPageSizeChange(value: number): void {
    this.pageSize = Number(value);
    this.page = 1;
    this.loadRawData();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.loadRawData();
  }

  deleteByDateRange(): void {
    if (!this.filterFromPunchDate || !this.filterToPunchDate) {
      this.message = 'From Punch Date and To Punch Date are required to delete by date range.';
      return;
    }

    if (this.filterToPunchDate < this.filterFromPunchDate) {
      this.message = 'To Punch Date cannot be earlier than From Punch Date.';
      return;
    }

    const normalizedEmpCode = this.filterEmployeeCode.trim();
    const scopeText = normalizedEmpCode
      ? ` for employee ${normalizedEmpCode}`
      : '';
    const confirmed = window.confirm(
      `Delete raw data from ${this.filterFromPunchDate} to ${this.filterToPunchDate}${scopeText}?`
    );
    if (!confirmed) {
      return;
    }

    this.deletingRange = true;
    this.attendanceRawDataService.deleteByDateRange({
      fromPunchDate: this.filterFromPunchDate,
      toPunchDate: this.filterToPunchDate,
      employeeCode: normalizedEmpCode || null
    }).subscribe({
      next: (result) => {
        this.message = `Deleted ${result.deletedCount} raw data rows.`;
        this.page = 1;
        this.loadRawData();
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to delete raw data by date range.';
      },
      complete: () => {
        this.deletingRange = false;
      }
    });
  }

  get hasPreviousPage(): boolean {
    return this.page > 1;
  }

  get hasNextPage(): boolean {
    return this.page < this.totalPages;
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = String(date.getFullYear()).slice(-2);
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const hourText = String(hour12).padStart(2, '0');
    return `${day}-${month}-${year} | ${hourText}:${minute} ${meridiem}`;
  }
}

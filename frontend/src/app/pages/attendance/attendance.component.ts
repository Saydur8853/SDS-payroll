import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AttendanceDailyDetail, AttendanceRecord } from '../../models/attendance.model';
import { LookupItem } from '../../models/lookup.model';
import { AttendanceService } from '../../services/attendance.service';
import { LookupService } from '../../services/lookup.service';

@Component({
  selector: 'app-attendance',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss'
})
export class AttendanceComponent implements OnInit {
  private readonly monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private readonly scrollBottomThresholdPx = 80;
  @ViewChild('detailsTableWrap') private detailsTableWrap?: ElementRef<HTMLDivElement>;
  detailItems: AttendanceDailyDetail[] = [];
  departments: LookupItem[] = [];
  designations: LookupItem[] = [];

  uploadFile: File | null = null;
  uploadReplaceExisting = true;

  loading = false;
  loadingMore = false;
  uploading = false;
  uploadProgressPercent = 0;
  uploadProgressLabel = '';
  saving = false;
  deletingId: string | null = null;
  message = '';

  filterEmployeeCode: number | null = null;
  commonFromDate = '';
  commonToDate = '';
  commonDepartment: string | null = null;
  commonDesignation: string | null = null;

  page = 1;
  pageSize = 50;
  totalCount = 0;
  totalPages = 0;

  editingId: string | null = null;
  editEmployeeCode: number | null = null;
  editPunchTime = '';
  editRemarks = '';

  readonly pageSizeOptions = [20, 50, 100];

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly lookupService: LookupService
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadAttendance();
  }

  loadLookups(): void {
    forkJoin({
      departments: this.lookupService.getDepartments(),
      designations: this.lookupService.getDesignations()
    }).subscribe({
      next: (data) => {
        this.departments = data.departments;
        this.designations = data.designations;
      },
      error: () => {
        this.message = 'Failed to load filter options.';
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
  }

  uploadAttendance(): void {
    if (!this.uploadFile) {
      this.message = 'Please select an MDB file.';
      return;
    }

    if (!this.commonFromDate || !this.commonToDate) {
      this.message = 'From and To date are required.';
      return;
    }

    if (this.commonToDate < this.commonFromDate) {
      this.message = 'To date cannot be earlier than From date.';
      return;
    }

    this.uploading = true;
    this.uploadProgressPercent = 0;
    this.uploadProgressLabel = 'Starting upload...';
    this.attendanceService.uploadMdb({
      file: this.uploadFile,
      sourceType: null,
      fromDate: this.commonFromDate,
      toDate: this.commonToDate,
      replaceExisting: this.uploadReplaceExisting,
      company: null,
      department: this.commonDepartment,
      designation: this.commonDesignation,
      employeeCodesCsv: null
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
          this.uploadProgressPercent = 100;
          this.uploadProgressLabel = 'Upload complete.';
          this.message = `Upload complete. Read ${result.totalPunchRowsRead}, inserted ${result.insertedRows}, duplicates skipped ${result.duplicateRowsSkipped}, invalid skipped ${result.invalidRowsSkipped}.`;
          if (result.totalPunchRowsRead === 0 && result.sourceMinPunchTimeUtc && result.sourceMaxPunchTimeUtc) {
            const min = new Date(result.sourceMinPunchTimeUtc).toLocaleString();
            const max = new Date(result.sourceMaxPunchTimeUtc).toLocaleString();
            this.message += ` File data range: ${min} to ${max}.`;
          }
          this.loadAttendance();
        } else if (event.type === HttpEventType.ResponseHeader) {
          this.uploadProgressPercent = 100;
          this.uploadProgressLabel = 'Upload sent. Processing on server...';
        }
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to upload attendance MDB.';
        this.uploadProgressLabel = '';
      },
      complete: () => {
        this.uploading = false;
        this.uploadProgressPercent = 0;
        this.uploadProgressLabel = '';
      }
    });
  }

  loadAttendance(options: { append?: boolean; previousPage?: number; resetScrollTop?: boolean } = {}): void {
    const append = options.append ?? false;
    this.loading = true;
    const params = {
      page: this.page,
      pageSize: this.pageSize,
      employeeCode: this.filterEmployeeCode,
      fromDate: this.commonFromDate || null,
      toDate: this.commonToDate || null,
      company: null,
      department: this.commonDepartment,
      designation: this.commonDesignation
    };

    this.attendanceService.getDetails(params).subscribe({
      next: (response) => {
        this.detailItems = append ? [...this.detailItems, ...response.items] : response.items;
        this.totalCount = response.totalCount;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalPages = response.totalPages;
      },
      error: () => {
        this.message = 'Failed to load attendance details.';
        if (append && options.previousPage) {
          this.page = options.previousPage;
        }
      },
      complete: () => {
        this.loading = false;
        this.loadingMore = false;
        if (options.resetScrollTop) {
          this.resetGridScrollTop();
        }
      }
    });
  }

  onGridScroll(event: Event): void {
    if (this.loading || this.loadingMore || !this.hasNextPage()) {
      return;
    }

    const container = event.target as HTMLElement | null;
    if (!container) {
      return;
    }

    const remainingDistance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remainingDistance > this.scrollBottomThresholdPx) {
      return;
    }

    this.loadNextPageOnScroll();
  }

  private loadNextPageOnScroll(): void {
    if (this.loading || this.loadingMore || !this.hasNextPage()) {
      return;
    }

    const previousPage = this.page;
    this.page += 1;
    this.loadingMore = true;
    this.loadAttendance({ append: true, previousPage });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadAttendance();
  }

  resetFilters(): void {
    this.filterEmployeeCode = null;
    this.commonFromDate = '';
    this.commonToDate = '';
    this.commonDepartment = null;
    this.commonDesignation = null;
    this.page = 1;
    this.loadAttendance();
  }

  onPageSizeChange(value: number): void {
    this.pageSize = Number(value);
    this.page = 1;
    this.loadAttendance();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }
    this.page = page;
    this.loadAttendance({ resetScrollTop: true });
  }

  startEdit(item: AttendanceRecord): void {
    this.editingId = item.id;
    this.editEmployeeCode = item.employeeCode;
    this.editPunchTime = this.toDateTimeLocalValue(item.punchTime);
    this.editRemarks = item.remarks ?? '';
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editEmployeeCode = null;
    this.editPunchTime = '';
    this.editRemarks = '';
  }

  saveEdit(item: AttendanceRecord): void {
    if (!this.editingId || this.editEmployeeCode === null || this.editEmployeeCode === undefined || !this.editPunchTime) {
      this.message = 'Employee code and punch time are required.';
      return;
    }

    this.saving = true;
    this.attendanceService.update(item.id, {
      employeeCode: this.editEmployeeCode,
      punchTime: new Date(this.editPunchTime).toISOString(),
      remarks: this.editRemarks.trim() || null
    }).subscribe({
      next: () => {
        this.message = 'Attendance updated successfully.';
        this.cancelEdit();
        this.loadAttendance();
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to update attendance.';
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  delete(item: AttendanceRecord): void {
    if (!window.confirm(`Delete attendance record for employee ${item.employeeCode}?`)) {
      return;
    }

    this.deletingId = item.id;
    this.attendanceService.delete(item.id).subscribe({
      next: () => {
        this.message = 'Attendance record deleted.';
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.loadAttendance();
      },
      error: () => {
        this.message = 'Failed to delete attendance record.';
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  get pageStartIndex(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    if (this.loadedRecordsCount > this.pageSize) {
      return 1;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    if (this.loadedRecordsCount > this.pageSize) {
      return Math.min(this.loadedRecordsCount, this.totalCount);
    }
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  get loadedRecordsCount(): number {
    return this.detailItems.length;
  }

  formatDate(value: string): string {
    const date = this.parseDateValue(value);
    if (!date) {
      return value;
    }

    return this.formatDateParts(date);
  }

  formatPunchTime(value: string): string {
    const date = this.parseDateValue(value);
    if (!date) {
      return value;
    }

    const datePart = this.formatDateParts(date);
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const hourText = String(hour12).padStart(2, '0');
    return `${datePart} | ${hourText}:${minute} ${meridiem}`;
  }

  private parseDateValue(value: string): Date | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private formatDateParts(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = this.monthShortNames[date.getMonth()] ?? '';
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  formatMinutesAsDuration(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    const total = Math.max(0, Math.round(value));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  formatMinutesCompact(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return `${Math.max(0, Math.round(value))} min`;
  }

  hasPreviousPage(): boolean {
    return this.page > 1;
  }

  hasNextPage(): boolean {
    return this.page < this.totalPages;
  }

  private resetGridScrollTop(): void {
    setTimeout(() => {
      const container = this.detailsTableWrap?.nativeElement;
      container?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  private toDateTimeLocalValue(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
}

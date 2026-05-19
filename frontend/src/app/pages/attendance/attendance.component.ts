import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AttendanceDailyDetail, AttendanceRecord } from '../../models/attendance.model';
import { LookupItem } from '../../models/lookup.model';
import { Company } from '../../models/company.model';
import { AttendanceService } from '../../services/attendance.service';
import { LookupService } from '../../services/lookup.service';
import { CompanyService } from '../../services/company.service';

@Component({
  selector: 'app-attendance',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss'
})
export class AttendanceComponent implements OnInit {
  private readonly monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  viewMode: 'details' | 'raw' = 'details';
  detailItems: AttendanceDailyDetail[] = [];
  items: AttendanceRecord[] = [];
  companies: Company[] = [];
  departments: LookupItem[] = [];
  designations: LookupItem[] = [];

  uploadFile: File | null = null;
  uploadSourceType = '';
  uploadFromDate = this.today;
  uploadToDate = this.today;
  uploadReplaceExisting = true;
  uploadCompany: string | null = null;
  uploadDepartment: string | null = null;
  uploadDesignation: string | null = null;
  uploadEmployeeCodesCsv = '';

  loading = false;
  uploading = false;
  uploadProgressPercent = 0;
  uploadProgressLabel = '';
  saving = false;
  deletingId: string | null = null;
  message = '';

  searchText = '';
  filterEmployeeCode: number | null = null;
  filterSourceType: string | null = null;
  filterFromDate = '';
  filterToDate = '';
  filterCompany: string | null = null;
  filterDepartment: string | null = null;
  filterDesignation: string | null = null;

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
    private readonly lookupService: LookupService,
    private readonly companyService: CompanyService
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadAttendance();
  }

  private get today(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  loadLookups(): void {
    forkJoin({
      companies: this.companyService.getAll(),
      departments: this.lookupService.getDepartments(),
      designations: this.lookupService.getDesignations()
    }).subscribe({
      next: (data) => {
        this.companies = data.companies;
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

    if (!this.uploadFromDate || !this.uploadToDate) {
      this.message = 'From and To date are required.';
      return;
    }

    if (this.uploadToDate < this.uploadFromDate) {
      this.message = 'To date cannot be earlier than From date.';
      return;
    }

    this.uploading = true;
    this.uploadProgressPercent = 0;
    this.uploadProgressLabel = 'Starting upload...';
    this.attendanceService.uploadMdb({
      file: this.uploadFile,
      sourceType: this.uploadSourceType || null,
      fromDate: this.uploadFromDate,
      toDate: this.uploadToDate,
      replaceExisting: this.uploadReplaceExisting,
      company: this.uploadCompany,
      department: this.uploadDepartment,
      designation: this.uploadDesignation,
      employeeCodesCsv: this.uploadEmployeeCodesCsv || null
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

  loadAttendance(): void {
    this.loading = true;
    const params = {
      page: this.page,
      pageSize: this.pageSize,
      search: this.searchText || null,
      employeeCode: this.filterEmployeeCode,
      sourceType: this.filterSourceType,
      fromDate: this.filterFromDate || null,
      toDate: this.filterToDate || null,
      company: this.filterCompany,
      department: this.filterDepartment,
      designation: this.filterDesignation
    };

    if (this.viewMode === 'details') {
      this.attendanceService.getDetails(params).subscribe({
        next: (response) => {
          this.detailItems = response.items;
          this.items = [];
          this.totalCount = response.totalCount;
          this.totalPages = response.totalPages;
        },
        error: () => {
          this.message = 'Failed to load attendance details.';
        },
        complete: () => {
          this.loading = false;
        }
      });
      return;
    }

    this.attendanceService.getAll(params).subscribe({
      next: (response) => {
        this.detailItems = [];
        this.items = response.items;
        this.totalCount = response.totalCount;
        this.totalPages = response.totalPages;
      },
      error: () => {
        this.message = 'Failed to load attendance records.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onViewModeChange(mode: string): void {
    if (mode !== 'details' && mode !== 'raw') {
      return;
    }

    if (this.viewMode === mode) {
      return;
    }

    this.viewMode = mode;
    if (this.editingId) {
      this.cancelEdit();
    }
    this.page = 1;
    this.loadAttendance();
  }

  applyFilters(): void {
    this.page = 1;
    this.loadAttendance();
  }

  resetFilters(): void {
    this.searchText = '';
    this.filterEmployeeCode = null;
    this.filterSourceType = null;
    this.filterFromDate = '';
    this.filterToDate = '';
    this.filterCompany = null;
    this.filterDepartment = null;
    this.filterDesignation = null;
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
    this.loadAttendance();
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
    return (this.page - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return Math.min(this.page * this.pageSize, this.totalCount);
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

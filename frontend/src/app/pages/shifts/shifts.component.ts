import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Shift,
  ShiftTemporaryOverride,
  ShiftTemporaryOverrideUpsertRequest
} from '../../models/shift.model';
import { ShiftService, ShiftUsageEmployee } from '../../services/shift.service';

type OverrideFormState = {
  dateFrom: string;
  dateTo: string;
  inTime: string;
  outTime: string;
  reason: string;
  isActive: boolean;
};

type Meridiem = 'AM' | 'PM';

@Component({
  selector: 'app-shifts',
  imports: [CommonModule, FormsModule],
  templateUrl: './shifts.component.html',
  styleUrl: './shifts.component.scss'
})
export class ShiftsComponent implements OnInit {
  items: Shift[] = [];
  message = '';
  readonly hourOptions = Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, '0'));
  readonly minuteOptions = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));
  readonly meridiemOptions: Meridiem[] = ['AM', 'PM'];

  newName = '';
  newInTime = '';
  newOutTime = '';
  newInTimeGrace = '';
  newOutTimeGrace = '';
  newBreakStartTime = '';
  newBreakEndTime = '';

  editingId: string | null = null;
  editName = '';
  editInTime = '';
  editOutTime = '';
  editInTimeGrace = '';
  editOutTimeGrace = '';
  editBreakStartTime = '';
  editBreakEndTime = '';

  overrideFormsByShift: Record<string, OverrideFormState> = {};
  editingOverrideShiftId: string | null = null;
  editingOverrideId: string | null = null;
  editOverrideDateFrom = '';
  editOverrideDateTo = '';
  editOverrideInTime = '';
  editOverrideOutTime = '';
  editOverrideReason = '';
  editOverrideIsActive = true;
  createOverrideOpenByShift: Record<string, boolean> = {};
  isDeleteConfirmOpen = false;
  deleteConfirmCandidate: Shift | null = null;
  isDeleting = false;
  isMoveModalOpen = false;
  moveCandidate: Shift | null = null;
  moveMode: 'delete' | 'manual' = 'delete';
  moveTargetShiftId = '';
  moveCandidateEmployees: ShiftUsageEmployee[] = [];
  moveCandidateEmployeeCount = 0;
  selectedMoveEmployeeIds: string[] = [];
  isMoving = false;

  constructor(private readonly shiftService: ShiftService) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    if (!this.newName.trim()) {
      this.message = 'Shift name is required.';
      return;
    }

    if (!this.areRequiredCoreTimesFilled(this.newInTime, this.newOutTime, this.newInTimeGrace, this.newOutTimeGrace)) {
      this.message = 'In/Out time and grace time fields are required.';
      return;
    }

    this.shiftService.create({
      name: this.newName.trim(),
      inTime: this.newInTime,
      outTime: this.newOutTime,
      inTimeGrace: this.newInTimeGrace,
      outTimeGrace: this.newOutTimeGrace,
      breakStartTime: this.newBreakStartTime || null,
      breakEndTime: this.newBreakEndTime || null
    }).subscribe({
      next: () => {
        this.message = 'Shift added.';
        this.resetCreateForm();
        this.load();
      },
      error: () => {
        this.message = 'Failed to add shift.';
      }
    });
  }

  startEdit(item: Shift): void {
    this.editingId = item.id;
    this.editName = item.name;
    this.editInTime = this.normalizeTime(item.inTime);
    this.editOutTime = this.normalizeTime(item.outTime);
    this.editInTimeGrace = this.normalizeTime(item.inTimeGrace);
    this.editOutTimeGrace = this.normalizeTime(item.outTimeGrace);
    this.editBreakStartTime = this.normalizeTime(item.breakStartTime);
    this.editBreakEndTime = this.normalizeTime(item.breakEndTime);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
    this.editInTime = '';
    this.editOutTime = '';
    this.editInTimeGrace = '';
    this.editOutTimeGrace = '';
    this.editBreakStartTime = '';
    this.editBreakEndTime = '';
  }

  saveEdit(item: Shift): void {
    if (!this.editName.trim()) {
      this.message = 'Shift name is required.';
      return;
    }

    if (!this.areRequiredCoreTimesFilled(this.editInTime, this.editOutTime, this.editInTimeGrace, this.editOutTimeGrace)) {
      this.message = 'In/Out time and grace time fields are required.';
      return;
    }

    this.shiftService.update(item.id, {
      name: this.editName.trim(),
      inTime: this.editInTime,
      outTime: this.editOutTime,
      inTimeGrace: this.editInTimeGrace,
      outTimeGrace: this.editOutTimeGrace,
      breakStartTime: this.editBreakStartTime || null,
      breakEndTime: this.editBreakEndTime || null
    }).subscribe({
      next: () => {
        this.message = 'Shift updated.';
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.message = 'Failed to update shift.';
      }
    });
  }

  delete(item: Shift): void {
    this.deleteConfirmCandidate = item;
    this.isDeleteConfirmOpen = true;
  }

  cancelDeleteConfirm(): void {
    this.isDeleteConfirmOpen = false;
    this.deleteConfirmCandidate = null;
    this.isDeleting = false;
  }

  confirmDelete(): void {
    if (!this.deleteConfirmCandidate) {
      return;
    }

    const candidate = this.deleteConfirmCandidate;
    this.isDeleting = true;

    this.shiftService.delete(candidate.id).subscribe({
      next: () => {
        this.message = 'Shift deleted.';
        this.cancelDeleteConfirm();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.cancelDeleteConfirm();
        if (error.status === 409) {
          this.openMoveModal(candidate, 'delete');
          return;
        }

        this.message = 'Failed to delete shift.';
      }
    });
  }

  startManualMove(item: Shift): void {
    this.openMoveModal(item, 'manual');
  }

  closeMoveModal(): void {
    this.isMoveModalOpen = false;
    this.moveCandidate = null;
    this.moveMode = 'delete';
    this.moveTargetShiftId = '';
    this.moveCandidateEmployees = [];
    this.moveCandidateEmployeeCount = 0;
    this.selectedMoveEmployeeIds = [];
    this.isMoving = false;
  }

  moveEmployees(): void {
    if (!this.moveCandidate) {
      return;
    }

    if (!this.moveTargetShiftId) {
      this.message = 'Select a target shift to move employees.';
      return;
    }

    if (!this.selectedMoveEmployeeIds.length) {
      this.message = 'Select at least one employee to move.';
      return;
    }

    this.isMoving = true;
    const shouldDeleteSource = this.moveMode === 'delete';
    const employeeIds = shouldDeleteSource
      ? this.moveCandidateEmployees.map((x) => x.id)
      : this.selectedMoveEmployeeIds;

    this.shiftService
      .moveEmployees(this.moveCandidate.id, this.moveTargetShiftId, shouldDeleteSource, employeeIds)
      .subscribe({
        next: (result) => {
          if (!shouldDeleteSource) {
            this.message = `${result.movedCount} employee(s) moved successfully.`;
          } else {
            this.message = result.sourceDeleted
              ? `${result.movedCount} employee(s) moved and shift deleted.`
              : `${result.movedCount} employee(s) moved.`;
          }

          this.closeMoveModal();
          this.load();
        },
        error: () => {
          this.isMoving = false;
          this.message = 'Failed to move employees.';
        }
      });
  }

  getMoveTargetOptions(): Shift[] {
    if (!this.moveCandidate) {
      return this.items;
    }

    return this.items.filter((x) => x.id !== this.moveCandidate!.id);
  }

  isEmployeeSelected(id: string): boolean {
    return this.selectedMoveEmployeeIds.includes(id);
  }

  toggleEmployeeSelection(id: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedMoveEmployeeIds.includes(id)) {
        this.selectedMoveEmployeeIds = [...this.selectedMoveEmployeeIds, id];
      }
      return;
    }

    this.selectedMoveEmployeeIds = this.selectedMoveEmployeeIds.filter((x) => x !== id);
  }

  areAllEmployeesSelected(): boolean {
    return this.moveCandidateEmployees.length > 0 && this.selectedMoveEmployeeIds.length === this.moveCandidateEmployees.length;
  }

  toggleSelectAllEmployees(checked: boolean): void {
    this.selectedMoveEmployeeIds = checked ? this.moveCandidateEmployees.map((x) => x.id) : [];
  }

  getOverrideForm(shiftId: string): OverrideFormState {
    if (!this.overrideFormsByShift[shiftId]) {
      const today = this.getTodayDateValue();
      this.overrideFormsByShift[shiftId] = {
        dateFrom: today,
        dateTo: today,
        inTime: '',
        outTime: '',
        reason: '',
        isActive: true
      };
    }
    return this.overrideFormsByShift[shiftId];
  }

  createOverride(item: Shift): void {
    const form = this.getOverrideForm(item.id);
    const validationMessage = this.validateOverrideForm(form.dateFrom, form.dateTo, form.inTime, form.outTime);
    if (validationMessage) {
      this.message = validationMessage;
      return;
    }

    this.shiftService.createOverride(item.id, this.mapOverrideRequest(form)).subscribe({
      next: () => {
        this.message = 'Temporary timing added.';
        this.resetOverrideCreateForm(item.id);
        this.createOverrideOpenByShift[item.id] = false;
        this.load();
      },
      error: (error) => {
        const apiMessage = typeof error?.error === 'string' ? error.error : null;
        this.message = apiMessage ?? 'Failed to add temporary timing.';
      }
    });
  }

  startEditOverride(shiftId: string, override: ShiftTemporaryOverride): void {
    this.editingOverrideShiftId = shiftId;
    this.editingOverrideId = override.id;
    this.editOverrideDateFrom = override.dateFrom;
    this.editOverrideDateTo = override.dateTo;
    this.editOverrideInTime = this.normalizeTime(override.inTime);
    this.editOverrideOutTime = this.normalizeTime(override.outTime);
    this.editOverrideReason = override.reason ?? '';
    this.editOverrideIsActive = override.isActive;
  }

  cancelEditOverride(): void {
    this.editingOverrideShiftId = null;
    this.editingOverrideId = null;
    this.editOverrideDateFrom = '';
    this.editOverrideDateTo = '';
    this.editOverrideInTime = '';
    this.editOverrideOutTime = '';
    this.editOverrideReason = '';
    this.editOverrideIsActive = true;
  }

  saveEditOverride(shiftId: string, overrideId: string): void {
    const validationMessage = this.validateOverrideForm(
      this.editOverrideDateFrom,
      this.editOverrideDateTo,
      this.editOverrideInTime,
      this.editOverrideOutTime
    );
    if (validationMessage) {
      this.message = validationMessage;
      return;
    }

    const request: ShiftTemporaryOverrideUpsertRequest = {
      dateFrom: this.editOverrideDateFrom,
      dateTo: this.editOverrideDateTo,
      inTime: this.editOverrideInTime || null,
      outTime: this.editOverrideOutTime || null,
      reason: this.editOverrideReason.trim() || null,
      isActive: this.editOverrideIsActive
    };

    this.shiftService.updateOverride(shiftId, overrideId, request).subscribe({
      next: () => {
        this.message = 'Temporary timing updated.';
        this.cancelEditOverride();
        this.load();
      },
      error: (error) => {
        const apiMessage = typeof error?.error === 'string' ? error.error : null;
        this.message = apiMessage ?? 'Failed to update temporary timing.';
      }
    });
  }

  deleteOverride(shiftId: string, overrideId: string): void {
    if (!window.confirm('Delete this temporary timing?')) {
      return;
    }

    this.shiftService.deleteOverride(shiftId, overrideId).subscribe({
      next: () => {
        this.message = 'Temporary timing deleted.';
        if (this.editingOverrideId === overrideId) {
          this.cancelEditOverride();
        }
        this.load();
      },
      error: () => {
        this.message = 'Failed to delete temporary timing.';
      }
    });
  }

  isEditingOverride(shiftId: string, overrideId: string): boolean {
    return this.editingOverrideShiftId === shiftId && this.editingOverrideId === overrideId;
  }

  isCreateOverrideOpen(shiftId: string): boolean {
    return !!this.createOverrideOpenByShift[shiftId];
  }

  openCreateOverride(shiftId: string): void {
    this.createOverrideOpenByShift[shiftId] = true;
    this.getOverrideForm(shiftId);
  }

  cancelCreateOverride(shiftId: string): void {
    this.createOverrideOpenByShift[shiftId] = false;
    this.resetOverrideCreateForm(shiftId);
  }

  formatTimeForDisplay(timeValue: string | null | undefined): string {
    const normalized = this.normalizeTime(timeValue);
    if (!normalized) {
      return '-';
    }

    const [hourText, minuteText] = normalized.split(':');
    const hour24 = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isFinite(hour24) || !Number.isFinite(minute)) {
      return normalized;
    }

    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
  }

  formatDateForDisplay(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return '-';
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
    if (!match) {
      return dateValue;
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  getHourPart(timeValue: string | null | undefined): string {
    return this.parseTimeParts(timeValue).hour;
  }

  getMinutePart(timeValue: string | null | undefined): string {
    return this.parseTimeParts(timeValue).minute;
  }

  getMeridiemPart(timeValue: string | null | undefined): Meridiem {
    return this.parseTimeParts(timeValue).meridiem;
  }

  updateHourPart(currentValue: string, hour: string): string {
    return this.updateTimePart(currentValue, { hour });
  }

  updateMinutePart(currentValue: string, minute: string): string {
    return this.updateTimePart(currentValue, { minute });
  }

  updateMeridiemPart(currentValue: string, meridiem: Meridiem): string {
    return this.updateTimePart(currentValue, { meridiem });
  }

  private load(): void {
    this.shiftService.getAll().subscribe({
      next: (data) => {
        this.items = data;
        this.items.forEach((x) => this.getOverrideForm(x.id));
      }
    });
  }

  private openMoveModal(item: Shift, mode: 'delete' | 'manual'): void {
    this.moveCandidate = item;
    this.moveMode = mode;
    this.isMoveModalOpen = true;
    this.moveTargetShiftId = '';
    this.moveCandidateEmployees = [];
    this.moveCandidateEmployeeCount = 0;
    this.selectedMoveEmployeeIds = [];
    this.isMoving = false;

    this.shiftService.getUsage(item.id).subscribe({
      next: (usage) => {
        this.moveCandidateEmployeeCount = usage.employeeCount;
        this.moveCandidateEmployees = usage.employees;
        this.selectedMoveEmployeeIds = usage.employees.map((x) => x.id);
      },
      error: () => {
        this.message = 'Failed to load shift employee list.';
      }
    });
  }

  private resetCreateForm(): void {
    this.newName = '';
    this.newInTime = '';
    this.newOutTime = '';
    this.newInTimeGrace = '';
    this.newOutTimeGrace = '';
    this.newBreakStartTime = '';
    this.newBreakEndTime = '';
  }

  private areRequiredCoreTimesFilled(...times: string[]): boolean {
    return times.every(x => !!x?.trim());
  }

  private normalizeTime(timeValue: string | null | undefined): string {
    if (!timeValue) {
      return '';
    }

    return timeValue.trim().slice(0, 5);
  }

  private parseTimeParts(timeValue: string | null | undefined): { hour: string; minute: string; meridiem: Meridiem } {
    const normalized = this.normalizeTime(timeValue);
    if (!normalized) {
      return { hour: '', minute: '', meridiem: 'AM' };
    }

    const [hourText, minuteText] = normalized.split(':');
    const hour24 = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour24) || !Number.isFinite(minute)) {
      return { hour: '', minute: '', meridiem: 'AM' };
    }

    const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return {
      hour: hour12.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      meridiem
    };
  }

  private updateTimePart(
    currentValue: string | null | undefined,
    patch: Partial<{ hour: string; minute: string; meridiem: Meridiem }>
  ): string {
    const current = this.parseTimeParts(currentValue);
    let nextHour = patch.hour ?? current.hour ?? '';
    let nextMinute = patch.minute ?? current.minute ?? '';
    const nextMeridiem = patch.meridiem ?? current.meridiem ?? 'AM';

    // Allow selection in any order:
    // if user picks hour first, use 00 minute; if user picks minute first, use 12 hour.
    if (!nextMinute && patch.hour !== undefined) {
      nextMinute = '00';
    }
    if (!nextHour && patch.minute !== undefined) {
      nextHour = '12';
    }

    if (!nextHour || !nextMinute) {
      return '';
    }

    const hour12 = Number(nextHour);
    const minute = Number(nextMinute);
    if (!Number.isFinite(hour12) || !Number.isFinite(minute) || hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
      return '';
    }

    const hour24 = nextMeridiem === 'PM'
      ? (hour12 % 12) + 12
      : hour12 % 12;

    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private validateOverrideForm(dateFrom: string, dateTo: string, inTime: string, outTime: string): string | null {
    if (!dateFrom || !dateTo) {
      return 'Temporary timing requires both Date From and Date To.';
    }

    if (dateTo < dateFrom) {
      return 'Temporary timing Date To cannot be earlier than Date From.';
    }

    if (!inTime && !outTime) {
      return 'Temporary timing requires at least In Time or Out Time.';
    }

    return null;
  }

  private mapOverrideRequest(form: OverrideFormState): ShiftTemporaryOverrideUpsertRequest {
    return {
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      inTime: form.inTime || null,
      outTime: form.outTime || null,
      reason: form.reason.trim() || null,
      isActive: form.isActive
    };
  }

  private resetOverrideCreateForm(shiftId: string): void {
    const today = this.getTodayDateValue();
    this.overrideFormsByShift[shiftId] = {
      dateFrom: today,
      dateTo: today,
      inTime: '',
      outTime: '',
      reason: '',
      isActive: true
    };
  }

  private getTodayDateValue(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

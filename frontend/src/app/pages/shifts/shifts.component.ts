import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shift } from '../../models/shift.model';
import { ShiftService } from '../../services/shift.service';

@Component({
  selector: 'app-shifts',
  imports: [CommonModule, FormsModule],
  templateUrl: './shifts.component.html',
  styleUrl: './shifts.component.scss'
})
export class ShiftsComponent implements OnInit {
  items: Shift[] = [];
  message = '';

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

  constructor(private readonly shiftService: ShiftService) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    if (!this.newName.trim()) {
      this.message = 'Shift name is required.';
      return;
    }

    if (!this.areAllTimesFilled(this.newInTime, this.newOutTime, this.newInTimeGrace, this.newOutTimeGrace, this.newBreakStartTime, this.newBreakEndTime)) {
      this.message = 'All time fields are required.';
      return;
    }

    this.shiftService.create({
      name: this.newName.trim(),
      inTime: this.newInTime,
      outTime: this.newOutTime,
      inTimeGrace: this.newInTimeGrace,
      outTimeGrace: this.newOutTimeGrace,
      breakStartTime: this.newBreakStartTime,
      breakEndTime: this.newBreakEndTime
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

    if (!this.areAllTimesFilled(this.editInTime, this.editOutTime, this.editInTimeGrace, this.editOutTimeGrace, this.editBreakStartTime, this.editBreakEndTime)) {
      this.message = 'All time fields are required.';
      return;
    }

    this.shiftService.update(item.id, {
      name: this.editName.trim(),
      inTime: this.editInTime,
      outTime: this.editOutTime,
      inTimeGrace: this.editInTimeGrace,
      outTimeGrace: this.editOutTimeGrace,
      breakStartTime: this.editBreakStartTime,
      breakEndTime: this.editBreakEndTime
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
    if (!window.confirm(`Delete shift "${item.displayName}"?`)) {
      return;
    }

    this.shiftService.delete(item.id).subscribe({
      next: () => {
        this.message = 'Shift deleted.';
        this.load();
      },
      error: () => {
        this.message = 'Failed to delete shift.';
      }
    });
  }

  formatTimeForDisplay(timeValue: string): string {
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

  private load(): void {
    this.shiftService.getAll().subscribe({
      next: (data) => {
        this.items = data;
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

  private areAllTimesFilled(...times: string[]): boolean {
    return times.every(x => !!x?.trim());
  }

  private normalizeTime(timeValue: string | null | undefined): string {
    if (!timeValue) {
      return '';
    }

    return timeValue.trim().slice(0, 5);
  }
}

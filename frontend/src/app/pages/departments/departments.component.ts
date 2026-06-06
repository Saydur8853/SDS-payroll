import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LookupItem } from '../../models/lookup.model';
import { DepartmentUsageEmployee, LookupService } from '../../services/lookup.service';
import { GlassSelectComponent } from '../../shared/glass-select/glass-select.component';
import { lookupIdOptions } from '../../shared/glass-select/glass-select-options';

@Component({
  selector: 'app-departments',
  imports: [CommonModule, FormsModule, GlassSelectComponent],
  templateUrl: './departments.component.html',
  styleUrl: './departments.component.scss'
})
export class DepartmentsComponent implements OnInit {
  items: LookupItem[] = [];
  newName = '';
  newDynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  editingId: string | null = null;
  editName = '';
  editDynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  message = '';
  isDeleteConfirmOpen = false;
  deleteConfirmCandidate: LookupItem | null = null;
  isDeleting = false;
  isMoveModalOpen = false;
  deleteCandidate: LookupItem | null = null;
  moveMode: 'delete' | 'manual' = 'delete';
  moveTargetDepartmentId = '';
  moveCandidateEmployees: DepartmentUsageEmployee[] = [];
  moveCandidateEmployeeCount = 0;
  selectedMoveEmployeeIds: string[] = [];
  isMoving = false;
  readonly lookupIdOptions = lookupIdOptions;

  constructor(private readonly lookupService: LookupService) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) {
      this.message = 'Department name is required.';
      return;
    }

    this.lookupService.createDepartment(name, this.buildDynamicAttributesPayload(this.newDynamicEntries)).subscribe({
      next: () => {
        this.newName = '';
        this.newDynamicEntries = [{ key: '', value: '' }];
        this.message = 'Department added.';
        this.load();
      },
      error: () => {
        this.message = 'Failed to add department.';
      }
    });
  }

  startEdit(item: LookupItem): void {
    this.editingId = item.id;
    this.editName = item.name;
    this.editDynamicEntries = this.mapDynamicEntries(item.dynamicAttributes);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
    this.editDynamicEntries = [{ key: '', value: '' }];
  }

  saveEdit(item: LookupItem): void {
    const name = this.editName.trim();
    if (!name) {
      this.message = 'Department name is required.';
      return;
    }

    this.lookupService.updateDepartment(
      item.id,
      name,
      this.buildDynamicAttributesPayload(this.editDynamicEntries)
    ).subscribe({
      next: () => {
        this.message = 'Department updated.';
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.message = 'Failed to update department.';
      }
    });
  }

  delete(item: LookupItem): void {
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

    this.lookupService.deleteDepartment(candidate.id).subscribe({
      next: () => {
        this.message = 'Department deleted.';
        this.cancelDeleteConfirm();
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.cancelDeleteConfirm();
        if (error.status === 409) {
          this.openMoveModal(candidate, 'delete');
          return;
        }

        this.message = 'Failed to delete department.';
      }
    });
  }

  closeMoveModal(): void {
    this.isMoveModalOpen = false;
    this.deleteCandidate = null;
    this.moveMode = 'delete';
    this.moveTargetDepartmentId = '';
    this.moveCandidateEmployees = [];
    this.moveCandidateEmployeeCount = 0;
    this.selectedMoveEmployeeIds = [];
    this.isMoving = false;
  }

  startManualMove(item: LookupItem): void {
    this.openMoveModal(item, 'manual');
  }

  moveEmployees(): void {
    if (!this.deleteCandidate) {
      return;
    }

    if (!this.moveTargetDepartmentId) {
      this.message = 'Select a target department to move employees.';
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

    this.lookupService
      .moveDepartmentEmployees(this.deleteCandidate.id, this.moveTargetDepartmentId, shouldDeleteSource, employeeIds)
      .subscribe({
        next: (result) => {
          if (!shouldDeleteSource) {
            this.message = `${result.movedCount} employee(s) moved successfully.`;
          } else {
            this.message = result.sourceDeleted
              ? `${result.movedCount} employee(s) moved and department deleted.`
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

  getMoveTargetOptions(): LookupItem[] {
    if (!this.deleteCandidate) {
      return this.items;
    }

    return this.items.filter((x) => x.id !== this.deleteCandidate!.id);
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

  addNewDynamicAttributeRow(): void {
    this.newDynamicEntries.push({ key: '', value: '' });
  }

  removeNewDynamicAttributeRow(index: number): void {
    if (this.newDynamicEntries.length === 1) {
      this.newDynamicEntries[0] = { key: '', value: '' };
      return;
    }

    this.newDynamicEntries.splice(index, 1);
  }

  addEditDynamicAttributeRow(): void {
    this.editDynamicEntries.push({ key: '', value: '' });
  }

  removeEditDynamicAttributeRow(index: number): void {
    if (this.editDynamicEntries.length === 1) {
      this.editDynamicEntries[0] = { key: '', value: '' };
      return;
    }

    this.editDynamicEntries.splice(index, 1);
  }

  private load(): void {
    this.lookupService.getDepartments().subscribe({
      next: (data) => {
        this.items = data;
      }
    });
  }

  private openMoveModal(item: LookupItem, mode: 'delete' | 'manual'): void {
    this.deleteCandidate = item;
    this.moveMode = mode;
    this.isMoveModalOpen = true;
    this.moveTargetDepartmentId = '';
    this.moveCandidateEmployees = [];
    this.moveCandidateEmployeeCount = 0;
    this.selectedMoveEmployeeIds = [];
    this.isMoving = false;

    this.lookupService.getDepartmentUsage(item.id).subscribe({
      next: (usage) => {
        this.moveCandidateEmployeeCount = usage.employeeCount;
        this.moveCandidateEmployees = usage.employees;
        this.selectedMoveEmployeeIds = usage.employees.map((x) => x.id);
      },
      error: () => {
        this.message = 'Failed to load department employee list.';
      }
    });
  }

  private buildDynamicAttributesPayload(entries: Array<{ key: string; value: string }>): Record<string, string> {
    return entries.reduce((accumulator, entry) => {
      const key = entry.key.trim();
      if (key) {
        accumulator[key] = entry.value.trim();
      }

      return accumulator;
    }, {} as Record<string, string>);
  }

  private mapDynamicEntries(source?: Record<string, string | null>): Array<{ key: string; value: string }> {
    const entries = Object.entries(source ?? {}).map(([key, value]) => ({
      key,
      value: value ?? ''
    }));

    return entries.length > 0 ? entries : [{ key: '', value: '' }];
  }
}

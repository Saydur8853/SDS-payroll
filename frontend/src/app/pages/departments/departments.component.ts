import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookupItem } from '../../models/lookup.model';
import { LookupService } from '../../services/lookup.service';

@Component({
  selector: 'app-departments',
  imports: [CommonModule, FormsModule],
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
    if (!window.confirm(`Delete department "${item.name}"?`)) {
      return;
    }

    this.lookupService.deleteDepartment(item.id).subscribe({
      next: () => {
        this.message = 'Department deleted.';
        this.load();
      },
      error: () => {
        this.message = 'Failed to delete department.';
      }
    });
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

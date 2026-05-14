import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookupItem } from '../../models/lookup.model';
import { LookupService } from '../../services/lookup.service';

@Component({
  selector: 'app-designations',
  imports: [CommonModule, FormsModule],
  templateUrl: './designations.component.html',
  styleUrl: './designations.component.scss'
})
export class DesignationsComponent implements OnInit {
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
      this.message = 'Designation name is required.';
      return;
    }

    this.lookupService.createDesignation(name, this.buildDynamicAttributesPayload(this.newDynamicEntries)).subscribe({
      next: () => {
        this.newName = '';
        this.newDynamicEntries = [{ key: '', value: '' }];
        this.message = 'Designation added.';
        this.load();
      },
      error: () => {
        this.message = 'Failed to add designation.';
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
      this.message = 'Designation name is required.';
      return;
    }

    this.lookupService.updateDesignation(
      item.id,
      name,
      this.buildDynamicAttributesPayload(this.editDynamicEntries)
    ).subscribe({
      next: () => {
        this.message = 'Designation updated.';
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.message = 'Failed to update designation.';
      }
    });
  }

  delete(item: LookupItem): void {
    if (!window.confirm(`Delete designation "${item.name}"?`)) {
      return;
    }

    this.lookupService.deleteDesignation(item.id).subscribe({
      next: () => {
        this.message = 'Designation deleted.';
        this.load();
      },
      error: () => {
        this.message = 'Failed to delete designation.';
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
    this.lookupService.getDesignations().subscribe({
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

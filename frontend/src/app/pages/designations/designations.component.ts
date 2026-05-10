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
  editingId: string | null = null;
  editName = '';
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

    this.lookupService.createDesignation(name).subscribe({
      next: () => {
        this.newName = '';
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
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
  }

  saveEdit(item: LookupItem): void {
    const name = this.editName.trim();
    if (!name) {
      this.message = 'Designation name is required.';
      return;
    }

    this.lookupService.updateDesignation(item.id, name).subscribe({
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

  private load(): void {
    this.lookupService.getDesignations().subscribe({
      next: (data) => {
        this.items = data;
      }
    });
  }
}

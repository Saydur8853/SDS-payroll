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
      this.message = 'Department name is required.';
      return;
    }

    this.lookupService.createDepartment(name).subscribe({
      next: () => {
        this.newName = '';
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
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
  }

  saveEdit(item: LookupItem): void {
    const name = this.editName.trim();
    if (!name) {
      this.message = 'Department name is required.';
      return;
    }

    this.lookupService.updateDepartment(item.id, name).subscribe({
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

  private load(): void {
    this.lookupService.getDepartments().subscribe({
      next: (data) => {
        this.items = data;
      }
    });
  }
}

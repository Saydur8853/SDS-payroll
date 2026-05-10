import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EmployeeService } from '../../services/employee.service';
import { Employee } from '../../models/employee.model';
import { LookupItem } from '../../models/lookup.model';
import { LookupService } from '../../services/lookup.service';

@Component({
  selector: 'app-employee-info',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-info.component.html',
  styleUrl: './employee-info.component.scss'
})
export class EmployeeInfoComponent implements OnInit {
  private readonly addDepartmentOption = '__add_new_department__';
  private readonly addDesignationOption = '__add_new_designation__';

  employees: Employee[] = [];
  departments: LookupItem[] = [];
  designations: LookupItem[] = [];

  employeeCode = '';
  fullName = '';
  email = '';
  phone = '';
  department = '';
  designation = '';
  address = '';
  joiningDate = '';
  dynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  attributeSuggestionsByRow: Record<number, string[]> = {};

  editingEmployeeId: string | null = null;
  deletingEmployeeId: string | null = null;
  saving = false;
  message = '';

  editEmployeeCode = '';
  editFullName = '';
  editEmail = '';
  editPhone = '';
  editDepartment = '';
  editDesignation = '';
  editAddress = '';
  editJoiningDate = '';
  editDynamicEntries: Array<{ key: string; value: string }> = [];

  showDepartmentModal = false;
  showDesignationModal = false;
  newDepartmentName = '';
  newDesignationName = '';

  ngOnInit(): void {
    this.loadEmployees();
    this.loadLookups();
    this.onAttributeKeyInput(0);
  }

  addDynamicAttributeRow(): void {
    this.dynamicEntries.push({ key: '', value: '' });
  }

  removeDynamicAttributeRow(index: number): void {
    if (this.dynamicEntries.length === 1) {
      this.dynamicEntries[0] = { key: '', value: '' };
      return;
    }

    this.dynamicEntries.splice(index, 1);
  }

  onAttributeKeyInput(index: number): void {
    const query = this.dynamicEntries[index]?.key?.trim() ?? '';
    this.employeeService.getAttributeSuggestions(query).subscribe({
      next: (suggestions) => {
        this.attributeSuggestionsByRow[index] = suggestions;
      }
    });
  }

  applySuggestion(index: number, suggestion: string): void {
    this.dynamicEntries[index].key = suggestion;
  }

  onDepartmentChange(value: string): void {
    if (value === this.addDepartmentOption) {
      this.showDepartmentModal = true;
      this.department = '';
    } else {
      this.department = value;
    }
  }

  onDesignationChange(value: string): void {
    if (value === this.addDesignationOption) {
      this.showDesignationModal = true;
      this.designation = '';
    } else {
      this.designation = value;
    }
  }

  onEditDepartmentChange(value: string): void {
    if (value === this.addDepartmentOption) {
      this.showDepartmentModal = true;
    } else {
      this.editDepartment = value;
    }
  }

  onEditDesignationChange(value: string): void {
    if (value === this.addDesignationOption) {
      this.showDesignationModal = true;
    } else {
      this.editDesignation = value;
    }
  }

  closeDepartmentModal(): void {
    this.showDepartmentModal = false;
    this.newDepartmentName = '';
  }

  closeDesignationModal(): void {
    this.showDesignationModal = false;
    this.newDesignationName = '';
  }

  createDepartment(): void {
    const name = this.newDepartmentName.trim();
    if (!name) {
      this.message = 'Department name is required.';
      return;
    }

    this.lookupService.createDepartment(name).subscribe({
      next: (created) => {
        this.departments = [...this.departments, created].sort((a, b) => a.name.localeCompare(b.name));
        this.department = created.name;
        if (this.editingEmployeeId) {
          this.editDepartment = created.name;
        }
        this.closeDepartmentModal();
      },
      error: () => {
        this.message = 'Failed to create department (maybe already exists).';
      }
    });
  }

  createDesignation(): void {
    const name = this.newDesignationName.trim();
    if (!name) {
      this.message = 'Designation name is required.';
      return;
    }

    this.lookupService.createDesignation(name).subscribe({
      next: (created) => {
        this.designations = [...this.designations, created].sort((a, b) => a.name.localeCompare(b.name));
        this.designation = created.name;
        if (this.editingEmployeeId) {
          this.editDesignation = created.name;
        }
        this.closeDesignationModal();
      },
      error: () => {
        this.message = 'Failed to create designation (maybe already exists).';
      }
    });
  }

  saveEmployee(): void {
    if (!this.employeeCode.trim() || !this.fullName.trim() || !this.joiningDate) {
      this.message = 'Employee code, name and joining date are required.';
      return;
    }

    this.saving = true;
    this.employeeService.create({
      employeeCode: this.employeeCode.trim(),
      fullName: this.fullName.trim(),
      email: this.email.trim() || null,
      phone: this.phone.trim() || null,
      department: this.department.trim() || null,
      designation: this.designation.trim() || null,
      address: this.address.trim() || null,
      joiningDate: this.joiningDate,
      dynamicAttributes: this.buildDynamicAttributesPayload(this.dynamicEntries)
    }).subscribe({
      next: () => {
        this.message = 'Employee saved successfully.';
        this.resetCreateForm();
        this.loadEmployees();
      },
      error: () => {
        this.message = 'Failed to save employee.';
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  startEdit(employee: Employee): void {
    this.editingEmployeeId = employee.id;
    this.editEmployeeCode = employee.employeeCode;
    this.editFullName = employee.fullName;
    this.editEmail = employee.email ?? '';
    this.editPhone = employee.phone ?? '';
    this.editDepartment = employee.department ?? '';
    this.editDesignation = employee.designation ?? '';
    this.editAddress = employee.address ?? '';
    this.editJoiningDate = employee.joiningDate;
    this.editDynamicEntries = Object.entries(employee.dynamicAttributes).map(([key, value]) => ({
      key,
      value: value ?? ''
    }));
    if (this.editDynamicEntries.length === 0) {
      this.editDynamicEntries.push({ key: '', value: '' });
    }
  }

  cancelEdit(): void {
    this.editingEmployeeId = null;
    this.editDynamicEntries = [];
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

  async saveEdit(employee: Employee): Promise<void> {
    if (!this.editEmployeeCode.trim() || !this.editFullName.trim() || !this.editJoiningDate) {
      this.message = 'Employee code, name and joining date are required.';
      return;
    }

    try {
      await firstValueFrom(this.employeeService.update(employee.id, {
        employeeCode: this.editEmployeeCode.trim(),
        fullName: this.editFullName.trim(),
        email: this.editEmail.trim() || null,
        phone: this.editPhone.trim() || null,
        department: this.editDepartment.trim() || null,
        designation: this.editDesignation.trim() || null,
        address: this.editAddress.trim() || null,
        joiningDate: this.editJoiningDate
      }));

      await firstValueFrom(this.employeeService.replaceDynamicAttributes(
        employee.id,
        this.buildDynamicAttributesPayload(this.editDynamicEntries)
      ));

      this.message = 'Employee updated successfully.';
      this.cancelEdit();
      this.loadEmployees();
    } catch {
      this.message = 'Failed to update employee.';
    }
  }

  deleteEmployee(employee: Employee): void {
    if (!window.confirm(`Delete employee "${employee.fullName}"?`)) {
      return;
    }

    this.deletingEmployeeId = employee.id;
    this.employeeService.delete(employee.id).subscribe({
      next: () => {
        this.message = 'Employee deleted successfully.';
        this.loadEmployees();
      },
      error: () => {
        this.message = 'Failed to delete employee.';
      },
      complete: () => {
        this.deletingEmployeeId = null;
      }
    });
  }

  private loadEmployees(): void {
    this.employeeService.getAll().subscribe({
      next: (data) => {
        this.employees = data;
      },
      error: () => {
        this.message = 'Failed to load employees.';
      }
    });
  }

  private loadLookups(): void {
    this.lookupService.getDepartments().subscribe({
      next: (items) => {
        this.departments = items;
      }
    });

    this.lookupService.getDesignations().subscribe({
      next: (items) => {
        this.designations = items;
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

  private resetCreateForm(): void {
    this.employeeCode = '';
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.department = '';
    this.designation = '';
    this.address = '';
    this.joiningDate = '';
    this.dynamicEntries = [{ key: '', value: '' }];
    this.attributeSuggestionsByRow = {};
    this.onAttributeKeyInput(0);
  }

  get addDepartmentValue(): string {
    return this.addDepartmentOption;
  }

  get addDesignationValue(): string {
    return this.addDesignationOption;
  }

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly lookupService: LookupService
  ) {}
}

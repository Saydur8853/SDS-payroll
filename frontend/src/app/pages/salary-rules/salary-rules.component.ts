import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryRule, SalaryRuleUpsertRequest } from '../../models/salary-rule.model';
import { SalaryRuleService } from '../../services/salary-rule.service';

@Component({
  selector: 'app-salary-rules',
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-rules.component.html',
  styleUrl: './salary-rules.component.scss'
})
export class SalaryRulesComponent implements OnInit {
  items: SalaryRule[] = [];
  message = '';

  newRuleName = '';
  newBasicSalary: number | null = null;
  newHouseRent: number | null = null;
  newMedicalBill: number | null = null;
  newTransportBill: number | null = null;
  newFoodAllowance: number | null = null;
  newDynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];

  editingId: string | null = null;
  editRuleName = '';
  editBasicSalary: number | null = null;
  editHouseRent: number | null = null;
  editMedicalBill: number | null = null;
  editTransportBill: number | null = null;
  editFoodAllowance: number | null = null;
  editDynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];

  constructor(private readonly salaryRuleService: SalaryRuleService) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    const ruleName = this.newRuleName.trim();
    if (!ruleName) {
      this.message = 'Rule name is required.';
      return;
    }

    this.salaryRuleService.create(this.buildUpsertRequest(
      ruleName,
      this.newBasicSalary,
      this.newHouseRent,
      this.newMedicalBill,
      this.newTransportBill,
      this.newFoodAllowance,
      this.newDynamicEntries
    )).subscribe({
      next: () => {
        this.message = 'Salary rule added.';
        this.resetCreateForm();
        this.load();
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to add salary rule.';
      }
    });
  }

  startEdit(item: SalaryRule): void {
    this.editingId = item.id;
    this.editRuleName = item.ruleName;
    this.editBasicSalary = item.basicSalary;
    this.editHouseRent = item.houseRent;
    this.editMedicalBill = item.medicalBill;
    this.editTransportBill = item.transportBill;
    this.editFoodAllowance = item.foodAllowance;
    this.editDynamicEntries = this.mapDynamicEntries(item.dynamicAttributes);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editRuleName = '';
    this.editBasicSalary = null;
    this.editHouseRent = null;
    this.editMedicalBill = null;
    this.editTransportBill = null;
    this.editFoodAllowance = null;
    this.editDynamicEntries = [{ key: '', value: '' }];
  }

  saveEdit(item: SalaryRule): void {
    const ruleName = this.editRuleName.trim();
    if (!ruleName) {
      this.message = 'Rule name is required.';
      return;
    }

    this.salaryRuleService.update(item.id, this.buildUpsertRequest(
      ruleName,
      this.editBasicSalary,
      this.editHouseRent,
      this.editMedicalBill,
      this.editTransportBill,
      this.editFoodAllowance,
      this.editDynamicEntries
    )).subscribe({
      next: () => {
        this.message = 'Salary rule updated.';
        this.cancelEdit();
        this.load();
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to update salary rule.';
      }
    });
  }

  delete(item: SalaryRule): void {
    const confirmed = window.confirm(`Delete salary rule "${item.ruleName}"?`);
    if (!confirmed) {
      return;
    }

    this.salaryRuleService.delete(item.id).subscribe({
      next: () => {
        this.message = 'Salary rule deleted.';
        if (this.editingId === item.id) {
          this.cancelEdit();
        }
        this.load();
      },
      error: (error) => {
        this.message = typeof error?.error === 'string' ? error.error : 'Failed to delete salary rule.';
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
    this.salaryRuleService.getAll().subscribe({
      next: (data) => {
        this.items = data;
      },
      error: () => {
        this.message = 'Failed to load salary rules.';
      }
    });
  }

  private resetCreateForm(): void {
    this.newRuleName = '';
    this.newBasicSalary = null;
    this.newHouseRent = null;
    this.newMedicalBill = null;
    this.newTransportBill = null;
    this.newFoodAllowance = null;
    this.newDynamicEntries = [{ key: '', value: '' }];
  }

  private buildUpsertRequest(
    ruleName: string,
    basicSalary: number | null,
    houseRent: number | null,
    medicalBill: number | null,
    transportBill: number | null,
    foodAllowance: number | null,
    entries: Array<{ key: string; value: string }>
  ): SalaryRuleUpsertRequest {
    return {
      ruleName,
      basicSalary: this.normalizeAmount(basicSalary),
      houseRent: this.normalizeAmount(houseRent),
      medicalBill: this.normalizeAmount(medicalBill),
      transportBill: this.normalizeAmount(transportBill),
      foodAllowance: this.normalizeAmount(foodAllowance),
      dynamicAttributes: this.buildDynamicAttributesPayload(entries)
    };
  }

  private normalizeAmount(value: number | null): number {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 0;
    }

    return value;
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

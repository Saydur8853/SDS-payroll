import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CompanyService } from './services/company.service';
import { Company } from './models/company.model';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  companies: Company[] = [];
  name = '';
  address = '';
  logoUrl = '';
  selectedLogoFile: File | null = null;

  dynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  attributeSuggestionsByRow: Record<number, string[]> = {};
  isSaving = false;
  deletingCompanyId: string | null = null;
  editingCompanyId: string | null = null;
  updatingCompanyId: string | null = null;
  editName = '';
  editAddress = '';
  editLogoUrl = '';
  editDynamicEntries: Array<{ key: string; value: string }> = [];
  message = '';

  constructor(private readonly companyService: CompanyService) {}

  ngOnInit(): void {
    this.loadCompanies();
    this.onAttributeKeyInput(0);
  }

  addDynamicAttributeRow(): void {
    this.dynamicEntries.push({ key: '', value: '' });
    this.attributeSuggestionsByRow[this.dynamicEntries.length - 1] = [];
  }

  removeDynamicAttributeRow(index: number): void {
    if (this.dynamicEntries.length === 1) {
      this.dynamicEntries[0] = { key: '', value: '' };
      return;
    }

    this.dynamicEntries.splice(index, 1);
    delete this.attributeSuggestionsByRow[index];
    this.reindexSuggestionMap();
  }

  onAttributeKeyInput(index: number): void {
    const query = this.dynamicEntries[index]?.key?.trim() ?? '';
    this.companyService.getAttributeSuggestions(query).subscribe({
      next: (suggestions) => {
        this.attributeSuggestionsByRow[index] = suggestions.filter(
          (value, suggestionIndex, array) => array.indexOf(value) === suggestionIndex
        );
      }
    });
  }

  applySuggestion(index: number, suggestion: string): void {
    this.dynamicEntries[index].key = suggestion;
    this.onAttributeKeyInput(index);
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedLogoFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  saveCompany(): void {
    if (!this.name.trim() || !this.address.trim()) {
      this.message = 'Company name and address are required.';
      return;
    }

    const dynamicAttributes = this.buildDynamicAttributesPayload();
    this.isSaving = true;
    this.message = '';

    const request$ = this.selectedLogoFile
      ? this.companyService.createWithLogoUpload(this.name.trim(), this.address.trim(), dynamicAttributes, this.selectedLogoFile)
      : this.companyService.create({
          name: this.name.trim(),
          address: this.address.trim(),
          logoUrl: this.logoUrl.trim() ? this.logoUrl.trim() : null,
          dynamicAttributes
        });

    request$.subscribe({
      next: () => {
        this.message = 'Company saved successfully.';
        this.resetForm();
        this.loadCompanies();
      },
      error: () => {
        this.message = 'Failed to save company. Check backend URL/port and API status.';
        this.isSaving = false;
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  deleteCompany(company: Company): void {
    const confirmed = window.confirm(`Delete company "${company.name}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingCompanyId = company.id;
    this.companyService.delete(company.id).subscribe({
      next: () => {
        this.message = 'Company deleted successfully.';
        this.loadCompanies();
      },
      error: () => {
        this.message = 'Failed to delete company.';
      },
      complete: () => {
        this.deletingCompanyId = null;
      }
    });
  }

  startEdit(company: Company): void {
    this.editingCompanyId = company.id;
    this.editName = company.name;
    this.editAddress = company.address;
    this.editLogoUrl = company.logoUrl ?? '';
    this.editDynamicEntries = Object.entries(company.dynamicAttributes).map(([key, value]) => ({
      key,
      value: value ?? ''
    }));
    if (this.editDynamicEntries.length === 0) {
      this.editDynamicEntries.push({ key: '', value: '' });
    }
  }

  cancelEdit(): void {
    this.editingCompanyId = null;
    this.editName = '';
    this.editAddress = '';
    this.editLogoUrl = '';
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

  async saveEdit(company: Company): Promise<void> {
    if (!this.editName.trim() || !this.editAddress.trim()) {
      this.message = 'Company name and address are required.';
      return;
    }

    this.updatingCompanyId = company.id;
    try {
      await firstValueFrom(this.companyService.update(company.id, {
        name: this.editName.trim(),
        address: this.editAddress.trim(),
        logoUrl: this.editLogoUrl.trim() ? this.editLogoUrl.trim() : null
      }));

      const editedAttributes = this.buildEditDynamicAttributesPayload();
      await firstValueFrom(this.companyService.replaceDynamicAttributes(company.id, editedAttributes));

      this.message = 'Company updated successfully.';
      this.cancelEdit();
      this.loadCompanies();
    } catch {
      this.message = 'Failed to update company.';
    } finally {
      this.updatingCompanyId = null;
    }
  }

  toggleCompanyStatus(company: Company): void {
    const currentStatus = this.getCompanyStatus(company).toLowerCase();
    const nextStatus = currentStatus === 'active' ? 'Deactive' : 'Active';

    this.updatingCompanyId = company.id;
    this.companyService.upsertDynamicAttribute(company.id, 'status', nextStatus).subscribe({
      next: () => {
        this.message = `Company marked as ${nextStatus}.`;
        this.loadCompanies();
      },
      error: () => {
        this.message = 'Failed to update company status.';
      },
      complete: () => {
        this.updatingCompanyId = null;
      }
    });
  }

  getCompanyStatus(company: Company): string {
    const statusEntry = Object.entries(company.dynamicAttributes)
      .find(([key]) => key.trim().toLowerCase() === 'status');

    return statusEntry?.[1] ?? '';
  }

  private loadCompanies(): void {
    this.companyService.getAll().subscribe({
      next: (data) => {
        this.companies = data;
      },
      error: () => {
        this.message = 'Failed to load companies from API.';
      }
    });
  }

  private buildDynamicAttributesPayload(): Record<string, string> {
    return this.dynamicEntries.reduce((accumulator, entry) => {
      const key = entry.key.trim();
      if (key) {
        accumulator[key] = entry.value.trim();
      }
      return accumulator;
    }, {} as Record<string, string>);
  }

  private buildEditDynamicAttributesPayload(): Record<string, string> {
    return this.editDynamicEntries.reduce((accumulator, entry) => {
      const key = entry.key.trim();
      if (key) {
        accumulator[key] = entry.value.trim();
      }
      return accumulator;
    }, {} as Record<string, string>);
  }

  private resetForm(): void {
    this.name = '';
    this.address = '';
    this.logoUrl = '';
    this.selectedLogoFile = null;
    this.dynamicEntries = [{ key: '', value: '' }];
    this.attributeSuggestionsByRow = {};
    this.onAttributeKeyInput(0);
  }

  private reindexSuggestionMap(): void {
    const reordered: Record<number, string[]> = {};
    this.dynamicEntries.forEach((_, index) => {
      reordered[index] = this.attributeSuggestionsByRow[index] ?? [];
    });
    this.attributeSuggestionsByRow = reordered;
  }
}

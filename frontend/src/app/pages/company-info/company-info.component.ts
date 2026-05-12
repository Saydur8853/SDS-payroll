import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../../services/company.service';
import { Company } from '../../models/company.model';

@Component({
  selector: 'app-company-info',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-info.component.html',
  styleUrl: './company-info.component.scss'
})
export class CompanyInfoComponent implements OnInit {
  companies: Company[] = [];
  name = '';
  address = '';
  logoUrl = '';
  selectedLogoFile: File | null = null;
  logoBase64: string | null = null; // Preview for Add mode

  dynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  attributeSuggestionsByRow: Record<number, string[]> = {};
  isSaving = false;
  deletingCompanyId: string | null = null;
  editingCompanyId: string | null = null;
  updatingCompanyId: string | null = null;
  editName = '';
  editAddress = '';
  editLogoUrl = '';
  editLogoBase64: string | null = null; // Preview for Edit mode
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

  onLogoFileSelected(event: Event, isEdit: boolean = false): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;

    if (isEdit) {
      this.selectedLogoFile = file; // Note: You might want a separate editSelectedLogoFile if the backend supports it
      if (file) {
        this.convertToBase64(file, (base64) => this.editLogoBase64 = base64);
      } else {
        this.editLogoBase64 = null;
      }
    } else {
      this.selectedLogoFile = file;
      if (file) {
        this.convertToBase64(file, (base64) => this.logoBase64 = base64);
      } else {
        this.logoBase64 = null;
      }
    }
  }

  private convertToBase64(file: File, callback: (base64: string) => void): void {
    const reader = new FileReader();
    reader.onload = () => callback(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeLogo(isEdit: boolean = false): void {
    if (isEdit) {
      this.editLogoBase64 = null;
      this.editLogoUrl = '';
      // Also clear the file if needed
    } else {
      this.logoBase64 = null;
      this.logoUrl = '';
      this.selectedLogoFile = null;
    }
  }

  saveCompany(): void {
    if (!this.name.trim() || !this.address.trim()) {
      this.message = 'Company name and address are required.';
      return;
    }

    const dynamicAttributes = this.buildDynamicAttributesPayload();
    this.isSaving = true;
    this.message = '';

    const request$ = this.companyService.create({
          name: this.name.trim(),
          address: this.address.trim(),
          logoUrl: this.logoUrl.trim() ? this.logoUrl.trim() : null,
          logoBase64: this.logoBase64,
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
    this.editLogoBase64 = company.logoUrl ?? null; // If it's already a URL, show it
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
        logoUrl: this.editLogoUrl.trim() ? this.editLogoUrl.trim() : null,
        logoBase64: this.editLogoBase64
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

    return this.normalizeStatusValue(statusEntry?.[1] ?? '');
  }

  getStatusButtonClass(company: Company): string {
    return this.getCompanyStatus(company).toLowerCase() === 'active' ? 'primary' : 'muted';
  }

  getDisplayAttributeValue(key: string, value: string | null): string {
    if (key.trim().toLowerCase() === 'status') {
      return this.normalizeStatusValue(value ?? '');
    }
    return value ?? '';
  }

  getLogoUrl(company: Company): string {
    if (company.logoBase64) return company.logoBase64;
    const url = company.logoUrl;
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) {
      return url;
    }
    return `http://localhost:5277/${url}`;
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
    this.logoBase64 = null;
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

  private normalizeStatusValue(rawValue: string): string {
    const value = rawValue.trim().toLowerCase();
    if (value === 'active') {
      return 'Active';
    }

    if (value === 'deactive' || value === 'inactive' || value === 'deactivated') {
      return 'Deactive';
    }

    return rawValue.trim() || 'Deactive';
  }
}

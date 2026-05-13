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
  isLocatingAddress = false;
  isLocatingEditAddress = false;

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

  useCurrentLocation(isEdit: boolean = false): void {
    if (!navigator.geolocation) {
      this.message = 'Geolocation is not supported by this browser.';
      return;
    }

    if (isEdit) {
      this.isLocatingEditAddress = true;
    } else {
      this.isLocatingAddress = true;
    }
    this.message = 'Detecting current location...';

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const fallback = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;

        let resolvedAddress = fallback;
        try {
          const reverseAddress = await this.reverseGeocode(latitude, longitude);
          if (reverseAddress) {
            resolvedAddress = reverseAddress;
          }
        } catch {
          // Keep fallback coordinates if reverse lookup fails.
        }

        if (isEdit) {
          this.editAddress = resolvedAddress;
        } else {
          this.address = resolvedAddress;
        }

        this.message = 'Current location captured.';
        if (isEdit) {
          this.isLocatingEditAddress = false;
        } else {
          this.isLocatingAddress = false;
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          this.message = 'Location permission denied.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          this.message = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          this.message = 'Location request timed out.';
        } else {
          this.message = 'Failed to get current location.';
        }

        if (isEdit) {
          this.isLocatingEditAddress = false;
        } else {
          this.isLocatingAddress = false;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
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

  private async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      name?: string;
      display_name?: string;
      address?: {
        road?: string;
        suburb?: string;
        neighbourhood?: string;
        quarter?: string;
        city_district?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state_district?: string;
        postcode?: string;
        amenity?: string;
        shop?: string;
        office?: string;
        building?: string;
      };
    };

    const address = payload.address ?? {};
    const name = (
      payload.name ??
      address.amenity ??
      address.shop ??
      address.office ??
      address.building
    )?.trim() ?? '';

    const road = address.road?.trim() ?? '';
    const area = (
      address.suburb ??
      address.neighbourhood ??
      address.quarter ??
      address.city_district
    )?.trim() ?? '';
    const city = (
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.state_district
    )?.trim() ?? '';
    const postcode = address.postcode?.trim() ?? '';
    const cityPostcode = [city, postcode].filter(Boolean).join(' ');

    const segments = [name, road, area, cityPostcode]
      .filter(Boolean)
      .filter((value, index, array) =>
        array.findIndex(x => x.toLowerCase() === value.toLowerCase()) === index
      );

    if (segments.length > 0) {
      return segments.join(', ');
    }

    const fallback = payload.display_name?.trim() ?? '';
    if (!fallback) {
      return null;
    }

    return fallback
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
  }
}

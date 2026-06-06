import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, firstValueFrom } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { Authorizer, CreateAuthorizerRequest } from '../../models/authorizer.model';
import { LookupItem } from '../../models/lookup.model';
import { AuthorizerService } from '../../services/authorizer.service';
import { LookupService } from '../../services/lookup.service';
import { GlassSelectComponent } from '../../shared/glass-select/glass-select.component';
import { lookupOptions } from '../../shared/glass-select/glass-select-options';

@Component({
  selector: 'app-authorizers',
  imports: [CommonModule, FormsModule, ImageCropperComponent, GlassSelectComponent],
  templateUrl: './authorizers.component.html',
  styleUrl: './authorizers.component.scss'
})
export class AuthorizersComponent implements OnInit, OnDestroy {
  authorizers: Authorizer[] = [];
  departments: LookupItem[] = [];
  designations: LookupItem[] = [];

  name = '';
  designation = '';
  department = '';
  pinPassword = '';
  photoBase64: string | null = null;
  signatureBase64: string | null = null;

  editingId: string | null = null;
  saving = false;
  deletingId: string | null = null;
  message = '';
  showPinPasswordTemporarily = false;
  private hidePinTimeoutId: ReturnType<typeof setTimeout> | null = null;
  readonly lookupOptions = lookupOptions;

  showCropper = false;
  imageChangedEvent: any = '';
  croppedImage = '';
  croppingFor: 'photo' | 'signature' = 'photo';
  scale = 1;
  transform = {
    scale: 1,
    rotate: 0,
    flipH: false,
    flipV: false
  };

  constructor(
    private readonly authorizerService: AuthorizerService,
    private readonly lookupService: LookupService
  ) {}

  ngOnInit(): void {
    this.loadLookups();
    this.loadAuthorizers();
  }

  ngOnDestroy(): void {
    this.clearHidePinTimeout();
  }

  loadLookups(): void {
    forkJoin({
      departments: this.lookupService.getDepartments(),
      designations: this.lookupService.getDesignations()
    }).subscribe({
      next: (result) => {
        this.departments = result.departments;
        this.designations = result.designations;
      },
      error: () => {
        this.message = 'Failed to load departments/designations.';
      }
    });
  }

  loadAuthorizers(): void {
    this.authorizerService.getAll().subscribe({
      next: (data) => {
        this.authorizers = data;
      },
      error: () => {
        this.message = 'Failed to load authorizers.';
      }
    });
  }

  async save(): Promise<void> {
    if (!this.name.trim() || !this.designation.trim() || !this.department.trim() || !this.pinPassword.trim()) {
      this.message = 'Name, designation, department and PIN/Password are required.';
      return;
    }
    if (!this.signatureBase64) {
      this.message = 'Signature is required.';
      return;
    }
    if (!this.isValidPinOrPassword(this.pinPassword)) {
      this.message = 'If using PIN, it must be exactly 4 digits.';
      return;
    }

    this.saving = true;

    const designationLookup = this.designations.find(
      x => x.name.toLowerCase() === this.designation.trim().toLowerCase()
    );
    const departmentLookup = this.departments.find(
      x => x.name.toLowerCase() === this.department.trim().toLowerCase()
    );

    const request: CreateAuthorizerRequest = {
      name: this.name.trim(),
      designation: this.designation.trim(),
      designationId: designationLookup?.id ?? null,
      department: this.department.trim(),
      departmentId: departmentLookup?.id ?? null,
      photoBase64: this.photoBase64,
      signatureBase64: this.signatureBase64,
      pinPassword: this.pinPassword.trim()
    };

    try {
      if (this.editingId) {
        await firstValueFrom(this.authorizerService.update(this.editingId, request));
        this.message = 'Authorizer updated successfully.';
      } else {
        await firstValueFrom(this.authorizerService.create(request));
        this.message = 'Authorizer saved successfully.';
      }

      this.resetForm();
      this.loadAuthorizers();
    } catch (error: any) {
      if (error?.status === 409) {
        this.message = typeof error.error === 'string' ? error.error : 'Authorizer already exists.';
      } else {
        this.message = this.editingId ? 'Failed to update authorizer.' : 'Failed to save authorizer.';
      }
    } finally {
      this.saving = false;
    }
  }

  startEdit(item: Authorizer): void {
    this.editingId = item.id;
    this.name = item.name;
    this.designation = item.designation;
    this.department = item.department;
    this.pinPassword = item.pinPassword;
    this.photoBase64 = item.photoBase64 ?? null;
    this.signatureBase64 = item.signatureBase64 ?? null;

    if (this.designation && !this.designations.some(x => x.name.toLowerCase() === this.designation.toLowerCase())) {
      this.designations = [...this.designations, { id: `legacy-designation-${item.id}`, name: this.designation }]
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (this.department && !this.departments.some(x => x.name.toLowerCase() === this.department.toLowerCase())) {
      this.departments = [...this.departments, { id: `legacy-department-${item.id}`, name: this.department }]
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetForm();
    this.message = 'Edit canceled.';
  }

  delete(item: Authorizer): void {
    const confirmed = window.confirm(`Delete authorizer "${item.name}"?`);
    if (!confirmed) {
      return;
    }

    this.deletingId = item.id;
    this.authorizerService.delete(item.id).subscribe({
      next: () => {
        this.message = 'Authorizer deleted successfully.';
        if (this.editingId === item.id) {
          this.resetForm();
        }
        this.loadAuthorizers();
      },
      error: () => {
        this.message = 'Failed to delete authorizer.';
      },
      complete: () => {
        this.deletingId = null;
      }
    });
  }

  getPhotoSrc(item: Authorizer): string | null {
    return this.resolveImageSource(item.photoBase64);
  }

  getSignatureSrc(item: Authorizer): string | null {
    return this.resolveImageSource(item.signatureBase64);
  }

  getMaskedPin(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return '*'.repeat(Math.max(4, value.length));
  }

  revealPinPasswordForMoment(): void {
    if (!this.pinPassword.trim()) {
      return;
    }

    this.showPinPasswordTemporarily = true;
    this.clearHidePinTimeout();
    this.hidePinTimeoutId = setTimeout(() => {
      this.showPinPasswordTemporarily = false;
      this.hidePinTimeoutId = null;
    }, 2000);
  }

  onFileChange(event: Event, type: 'photo' | 'signature'): void {
    this.croppingFor = type;
    this.imageChangedEvent = event;
    this.showCropper = true;
  }

  imageCropped(event: ImageCroppedEvent): void {
    if (event.base64) {
      this.croppedImage = event.base64;
      return;
    }

    if (event.objectUrl) {
      this.croppedImage = '';
      this.convertObjectUrlToBase64(event.objectUrl)
        .then((base64) => {
          this.croppedImage = base64;
        })
        .catch(() => {
          this.croppedImage = '';
          this.message = 'Failed to process image. Please try again.';
        });
      return;
    }

    this.croppedImage = '';
  }

  imageLoaded(_image: LoadedImage): void {
    // cropper loaded
  }

  cropperReady(): void {
    // cropper ready
  }

  loadImageFailed(): void {
    this.message = 'Failed to load image. Please try another file.';
  }

  async applyCrop(): Promise<void> {
    if (!this.croppedImage) {
      this.message = 'Processing image, please wait a moment...';
      return;
    }

    let finalImage = this.croppedImage;
    if (this.croppingFor === 'signature') {
      try {
        finalImage = await this.cleanSignatureBackground(finalImage);
      } catch {
        finalImage = this.croppedImage;
      }
    }

    if (this.croppingFor === 'photo') {
      this.photoBase64 = finalImage;
    } else {
      this.signatureBase64 = finalImage;
    }

    this.cancelCrop();
  }

  cancelCrop(): void {
    this.showCropper = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
    this.scale = 1;
    this.transform = {
      ...this.transform,
      scale: 1
    };
  }

  zoomOut(): void {
    this.scale = Math.max(0.1, this.scale - 0.1);
    this.updateTransform();
  }

  zoomIn(): void {
    this.scale += 0.1;
    this.updateTransform();
  }

  removeImage(type: 'photo' | 'signature'): void {
    if (type === 'photo') {
      this.photoBase64 = null;
      return;
    }

    this.signatureBase64 = null;
  }

  @HostListener('wheel', ['$event'])
  onMouseWheel(event: WheelEvent): void {
    if (this.showCropper && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      this.scale = Math.max(0.1, Math.min(5, this.scale + delta));
      this.updateTransform();
    }
  }

  private updateTransform(): void {
    this.transform = {
      ...this.transform,
      scale: this.scale
    };
  }

  private resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.designation = '';
    this.department = '';
    this.pinPassword = '';
    this.showPinPasswordTemporarily = false;
    this.clearHidePinTimeout();
    this.photoBase64 = null;
    this.signatureBase64 = null;
  }

  private isValidPinOrPassword(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    const isDigitsOnly = /^\d+$/.test(trimmed);
    if (!isDigitsOnly) {
      return true;
    }

    return trimmed.length === 4;
  }

  private clearHidePinTimeout(): void {
    if (this.hidePinTimeoutId) {
      clearTimeout(this.hidePinTimeoutId);
      this.hidePinTimeoutId = null;
    }
  }

  private resolveImageSource(value?: string | null): string | null {
    const source = value?.trim();
    if (!source) {
      return null;
    }

    if (source.startsWith('data:image/')) {
      return source;
    }

    if (source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }

    if (source.startsWith('/uploads/')) {
      return `http://localhost:5277${source}`;
    }

    if (/^[A-Za-z0-9+/=]+$/.test(source)) {
      return `data:image/webp;base64,${source}`;
    }

    return null;
  }

  private async convertObjectUrlToBase64(objectUrl: string): Promise<string> {
    const response = await fetch(objectUrl);
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image to base64.'));
      reader.readAsDataURL(blob);
    });
  }

  private async cleanSignatureBackground(dataUrl: string): Promise<string> {
    const image = await this.loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');

    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    const width = canvas.width;
    const height = canvas.height;
    const pixelCount = width * height;

    const gray = new Uint8ClampedArray(pixelCount);
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const red = pixels[p];
      const green = pixels[p + 1];
      const blue = pixels[p + 2];
      gray[i] = Math.round((0.299 * red) + (0.587 * green) + (0.114 * blue));
    }

    const stride = width + 1;
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 1; y <= height; y++) {
      let rowSum = 0;
      for (let x = 1; x <= width; x++) {
        rowSum += gray[(y - 1) * width + (x - 1)];
        integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
      }
    }

    const radius = Math.max(8, Math.round(Math.min(width, height) * 0.08));
    const offset = 14;
    const inkMask = new Uint8Array(pixelCount);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - radius);
        const y1 = Math.max(0, y - radius);
        const x2 = Math.min(width - 1, x + radius);
        const y2 = Math.min(height - 1, y + radius);

        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum =
          integral[(y2 + 1) * stride + (x2 + 1)] -
          integral[y1 * stride + (x2 + 1)] -
          integral[(y2 + 1) * stride + x1] +
          integral[y1 * stride + x1];

        const localMean = sum / area;
        const index = y * width + x;
        inkMask[index] = gray[index] < (localMean - offset) ? 1 : 0;
      }
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = y * width + x;
        if (inkMask[index] === 0) {
          continue;
        }

        let neighbors = 0;
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -1; xx <= 1; xx++) {
            if (xx === 0 && yy === 0) {
              continue;
            }
            neighbors += inkMask[(y + yy) * width + (x + xx)];
          }
        }

        if (neighbors <= 1) {
          inkMask[index] = 0;
        }
      }
    }

    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      if (inkMask[i] === 1) {
        pixels[p] = 35;
        pixels[p + 1] = 35;
        pixels[p + 2] = 35;
      } else {
        pixels[p] = 255;
        pixels[p + 1] = 255;
        pixels[p + 2] = 255;
      }
      pixels[p + 3] = 255;
    }

    context.putImageData(frame, 0, 0);
    return canvas.toDataURL('image/webp', 0.95);
  }

  private loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load image.'));
      image.src = source;
    });
  }
}

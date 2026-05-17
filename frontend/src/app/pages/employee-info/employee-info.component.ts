import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, firstValueFrom, interval, startWith, Subscription, switchMap, takeWhile } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { EmployeeService, EmployeeCsvImportJobStatus } from '../../services/employee.service';
import { Employee } from '../../models/employee.model';
import { LookupItem } from '../../models/lookup.model';
import { LookupService } from '../../services/lookup.service';
import { ShiftService } from '../../services/shift.service';

type Meridiem = 'AM' | 'PM';

@Component({
  selector: 'app-employee-info',
  imports: [CommonModule, FormsModule, ImageCropperComponent],
  templateUrl: './employee-info.component.html',
  styleUrl: './employee-info.component.scss'
})
export class EmployeeInfoComponent implements OnInit, OnDestroy {
  private readonly addDepartmentOption = '__add_new_department__';
  private readonly addDesignationOption = '__add_new_designation__';
  private readonly addStatusOption = '__add_new_status__';
  private readonly addShiftOption = '__add_new_shift__';
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly phoneRegex = /^\d{10,}$/;
  private readonly monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private readonly minimumAgeYears = 18;

  employees: Employee[] = [];
  departments: LookupItem[] = [];
  designations: LookupItem[] = [];
  shifts: LookupItem[] = [];
  statusOptions: string[] = [];
  loadingEmployees = false;
  hasRequestedEmployees = false;

  employeeCode: number | null = null;
  fullName = '';
  email = '';
  phone = '';
  department = '';
  designation = '';
  employmentStatus = '';
  address = '';
  fatherName = '';
  motherName = '';
  spouseName = '';
  fatherPhone = '';
  motherPhone = '';
  spousePhone = '';
  gender = '';
  religion = '';
  maritalStatus = '';
  bloodGroup = '';
  nationalId = '';
  photoBase64: string | null = null;
  signatureBase64: string | null = null;
  workingTime = '';
  salaryRule = '';
  grossSalary: number | null = null;
  basicSalary: number | null = null;
  weekend = '';
  salaryAccount = '';
  dateOfBirth = '';
  joiningDate = '';
  dynamicEntries: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  attributeSuggestionsByRow: Record<number, string[]> = {};

  editingEmployeeId: string | null = null;
  deletingEmployeeId: string | null = null;
  saving = false;
  message = '';
  isEmployeeCodeDuplicate = false;
  isEditEmployeeCodeDuplicate = false;

  editEmployeeCode: number | null = null;
  editFullName = '';
  editEmail = '';
  editPhone = '';
  editDepartment = '';
  editDesignation = '';
  editEmploymentStatus = '';
  editAddress = '';
  editFatherName = '';
  editMotherName = '';
  editSpouseName = '';
  editFatherPhone = '';
  editMotherPhone = '';
  editSpousePhone = '';
  editGender = '';
  editReligion = '';
  editMaritalStatus = '';
  editBloodGroup = '';
  editNationalId = '';
  editPhotoBase64: string | null = null;
  editSignatureBase64: string | null = null;
  editWorkingTime = '';
  editSalaryRule = '';
  editGrossSalary: number | null = null;
  editBasicSalary: number | null = null;
  editWeekend = '';
  editSalaryAccount = '';
  editDateOfBirth = '';
  editJoiningDate = '';
  editDynamicEntries: Array<{ key: string; value: string }> = [];

  showDepartmentModal = false;
  showDesignationModal = false;
  showStatusModal = false;
  showShiftModal = false;
  newDepartmentName = '';
  newDesignationName = '';
  newStatusName = '';
  newShiftName = '';
  newShiftInTime = '';
  newShiftOutTime = '';
  newShiftInTimeGrace = '';
  newShiftOutTimeGrace = '';
  newShiftBreakStartTime = '';
  newShiftBreakEndTime = '';
  readonly shiftHourOptions = Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, '0'));
  readonly shiftMinuteOptions = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, '0'));
  readonly shiftMeridiemOptions: Meridiem[] = ['AM', 'PM'];

  searchText = '';
  filterDepartment = '';
  filterDesignation = '';
  filterJoiningDateFrom = '';
  filterJoiningDateTo = '';
  page = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  readonly pageSizeOptions = [10, 20, 50];
  readonly genderOptions = ['Male', 'Female', 'Other'];
  readonly maritalStatusOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
  readonly bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  readonly religionOptions = ['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Other'];
  exporting = false;
  importingCsv = false;
  showCsvUploadModal = false;
  csvDragOver = false;
  csvImportStatusMessage = '';
  csvImportErrors: string[] = [];
  csvBackgroundJobId: string | null = null;
  csvBackgroundJobStatus = '';
  csvBackgroundJobPercent = 0;
  showCsvFloatingBadge = false;
  private csvJobPollingSub: Subscription | null = null;

  // Cropper State
  showCropper = false;
  imageChangedEvent: any = '';
  croppedImage: any = '';
  croppingFor: 'photo' | 'signature' = 'photo';
  isEditMode = false;

  // Zoom/Transform
  scale = 1;
  transform: any = {
    scale: 1,
    rotate: 0,
    flipH: false,
    flipV: false
  };

  ngOnInit(): void {
    this.loadLookups();
    this.onAttributeKeyInput(0);
  }

  ngOnDestroy(): void {
    this.stopCsvJobPolling();
  }

  checkCode(): void {
    const code = this.employeeCode;
    if (code === null || code === undefined) {
      this.isEmployeeCodeDuplicate = false;
      return;
    }

    this.employeeService.checkEmployeeCode(code, this.editingEmployeeId ?? undefined).subscribe({
      next: (exists) => {
        this.isEmployeeCodeDuplicate = exists;
        if (exists) {
          this.message = `Employee code '${code}' is already taken.`;
        } else if (this.message === `Employee code '${code}' is already taken.`) {
          this.message = '';
        }
      }
    });
  }

  checkEditCode(): void {
    const code = this.editEmployeeCode;
    const id = this.editingEmployeeId;
    if (code === null || code === undefined || !id) {
      this.isEditEmployeeCodeDuplicate = false;
      return;
    }

    this.employeeService.checkEmployeeCode(code, id).subscribe({
      next: (exists) => {
        this.isEditEmployeeCodeDuplicate = exists;
        if (exists) {
          this.message = `Employee code '${code}' is already taken.`;
        } else if (this.message === `Employee code '${code}' is already taken.`) {
          this.message = '';
        }
      }
    });
  }

  // --- Image Upload & Cropping ---

  onFileChange(event: any, type: 'photo' | 'signature', isEdit: boolean): void {
    this.croppingFor = type;
    this.isEditMode = isEdit;
    this.imageChangedEvent = event;
    this.showCropper = true;
  }

  imageCropped(event: ImageCroppedEvent): void {
    console.log('Image cropped event fired', event);
    if (event.base64) {
      this.croppedImage = event.base64;
    } else if (event.objectUrl) {
      this.croppedImage = '';
      this.convertObjectUrlToBase64(event.objectUrl)
        .then((base64) => {
          this.croppedImage = base64;
        })
        .catch(() => {
          this.croppedImage = '';
          this.message = 'Failed to process image. Please try again.';
        });
    } else {
      this.croppedImage = '';
    }
  }

  imageLoaded(image: LoadedImage) {
    // show cropper
  }

  cropperReady() {
    // cropper ready
  }

  loadImageFailed() {
    this.message = 'Failed to load image. Please try another file.';
  }

  async applyCrop(): Promise<void> {
    console.log('Applying crop for:', this.croppingFor, 'isEdit:', this.isEditMode);
    console.log('Cropped image length:', this.croppedImage?.length);

    if (!this.croppedImage) {
      this.message = 'Processing image, please wait a moment...';
      return;
    }

    let finalImage = this.croppedImage as string;
    if (this.croppingFor === 'signature') {
      try {
        finalImage = await this.cleanSignatureBackground(finalImage);
      } catch {
        // Keep original crop if cleanup fails.
        finalImage = this.croppedImage as string;
      }
    }

    if (this.isEditMode) {
      if (this.croppingFor === 'photo') {
        this.editPhotoBase64 = finalImage;
      } else {
        this.editSignatureBase64 = finalImage;
      }
    } else {
      if (this.croppingFor === 'photo') {
        this.photoBase64 = finalImage;
      } else {
        this.signatureBase64 = finalImage;
      }
    }
    
    this.cancelCrop();
  }

  cancelCrop(): void {
    this.showCropper = false;
    this.imageChangedEvent = '';
    this.croppedImage = '';
    this.scale = 1;
    this.transform = { ...this.transform, scale: 1 };
  }

  zoomOut(): void {
    this.scale = Math.max(0.1, this.scale - 0.1);
    this.updateTransform();
  }

  zoomIn(): void {
    this.scale += 0.1;
    this.updateTransform();
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

  removeImage(type: 'photo' | 'signature', isEdit: boolean): void {
    if (isEdit) {
      if (type === 'photo') this.editPhotoBase64 = null;
      else this.editSignatureBase64 = null;
    } else {
      if (type === 'photo') this.photoBase64 = null;
      else this.signatureBase64 = null;
    }
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

  onStatusChange(value: string): void {
    if (value === this.addStatusOption) {
      this.showStatusModal = true;
      this.employmentStatus = '';
    } else {
      this.employmentStatus = value;
    }
  }

  onEditStatusChange(value: string): void {
    if (value === this.addStatusOption) {
      this.showStatusModal = true;
    } else {
      this.editEmploymentStatus = value;
    }
  }

  onWorkingTimeChange(value: string): void {
    if (value === this.addShiftOption) {
      this.showShiftModal = true;
      this.workingTime = '';
    } else {
      this.workingTime = value;
    }
  }

  onEditWorkingTimeChange(value: string): void {
    if (value === this.addShiftOption) {
      this.showShiftModal = true;
      this.editWorkingTime = '';
    } else {
      this.editWorkingTime = value;
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

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.newStatusName = '';
  }

  closeShiftModal(): void {
    this.showShiftModal = false;
    this.newShiftName = '';
    this.newShiftInTime = '';
    this.newShiftOutTime = '';
    this.newShiftInTimeGrace = '';
    this.newShiftOutTimeGrace = '';
    this.newShiftBreakStartTime = '';
    this.newShiftBreakEndTime = '';
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

  createStatus(): void {
    const name = this.newStatusName.trim();
    if (!name) {
      this.message = 'Status name is required.';
      return;
    }

    if (!this.statusOptions.some(x => x.toLowerCase() === name.toLowerCase())) {
      this.statusOptions = [...this.statusOptions, name].sort((a, b) => a.localeCompare(b));
    }

    this.employmentStatus = name;
    if (this.editingEmployeeId) {
      this.editEmploymentStatus = name;
    }

    this.closeStatusModal();
  }

  createShift(): void {
    const name = this.newShiftName.trim();
    if (!name) {
      this.message = 'Shift name is required.';
      return;
    }

    if (!this.newShiftInTime || !this.newShiftOutTime || !this.newShiftInTimeGrace || !this.newShiftOutTimeGrace) {
      this.message = 'In/Out time and grace time fields are required.';
      return;
    }

    this.shiftService.create({
      name,
      inTime: this.newShiftInTime,
      outTime: this.newShiftOutTime,
      inTimeGrace: this.newShiftInTimeGrace,
      outTimeGrace: this.newShiftOutTimeGrace,
      breakStartTime: this.newShiftBreakStartTime || null,
      breakEndTime: this.newShiftBreakEndTime || null
    }).subscribe({
      next: (created) => {
        const displayName = created.displayName;
        this.shifts = [...this.shifts, { id: created.id, name: displayName }]
          .sort((a, b) => a.name.localeCompare(b.name));
        this.workingTime = displayName;
        if (this.editingEmployeeId) {
          this.editWorkingTime = displayName;
        }
        this.closeShiftModal();
      },
      error: () => {
        this.message = 'Failed to create shift.';
      }
    });
  }

  async saveEmployee(): Promise<void> {
    if (this.isEmployeeCodeDuplicate) {
      this.message = 'Please use a unique employee code.';
      return;
    }
    if (
      this.employeeCode === null ||
      this.employeeCode === undefined ||
      !this.fullName.trim() ||
      !this.phone.trim() ||
      !this.employmentStatus.trim() ||
      !this.department.trim() ||
      !this.designation.trim() ||
      !this.gender.trim() ||
      !this.dateOfBirth ||
      !this.joiningDate
    ) {
      this.message = 'Employee code, name, phone, status, department, designation, gender, date of birth and joining date are required.';
      return;
    }
    if (!this.isEmailValid(this.email)) {
      this.message = 'Please enter a valid email format.';
      return;
    }
    if (!this.isPhoneValid(this.phone)) {
      this.message = 'Phone number must be at least 10 digits and contain only numbers.';
      return;
    }
    if (this.isDateInFuture(this.dateOfBirth)) {
      this.message = 'Date of birth cannot be after current date.';
      return;
    }
    if (this.isUnderMinimumAge(this.dateOfBirth)) {
      this.message = `Minimum age is ${this.minimumAgeYears} years.`;
      return;
    }
    if (this.isMaternityStatusInvalidForGender(this.employmentStatus, this.gender)) {
      this.message = 'This employee gender is not female.';
      return;
    }

    this.saving = true;
    const updateRequest = {
      employeeCode: this.employeeCode!,
      fullName: this.fullName.trim(),
      email: this.email.trim() || null,
      phone: this.phone.trim() || null,
      department: this.department.trim() || null,
      designation: this.designation.trim() || null,
      employmentStatus: this.employmentStatus.trim() || null,
      address: this.address.trim() || null,
      fatherName: this.fatherName.trim() || null,
      motherName: this.motherName.trim() || null,
      spouseName: this.spouseName.trim() || null,
      fatherPhone: this.fatherPhone.trim() || null,
      motherPhone: this.motherPhone.trim() || null,
      spousePhone: this.spousePhone.trim() || null,
      gender: this.gender.trim() || null,
      religion: this.religion.trim() || null,
      maritalStatus: this.maritalStatus.trim() || null,
      bloodGroup: this.bloodGroup.trim() || null,
      nationalId: this.nationalId.trim() || null,
      photoBase64: this.photoBase64,
      signatureBase64: this.signatureBase64,
      workingTime: this.workingTime.trim() || null,
      salaryRule: this.salaryRule.trim() || null,
      grossSalary: this.normalizeOptionalNumber(this.grossSalary),
      basicSalary: this.normalizeOptionalNumber(this.basicSalary),
      weekend: this.weekend.trim() || null,
      salaryAccount: this.salaryAccount.trim() || null,
      dateOfBirth: this.dateOfBirth || null,
      joiningDate: this.joiningDate
    };

    try {
      if (this.editingEmployeeId) {
        await firstValueFrom(this.employeeService.update(this.editingEmployeeId, updateRequest));
        await firstValueFrom(this.employeeService.replaceDynamicAttributes(
          this.editingEmployeeId,
          this.buildDynamicAttributesPayload(this.dynamicEntries)
        ));
        this.message = 'Employee updated successfully.';
      } else {
        await firstValueFrom(this.employeeService.create({
          ...updateRequest,
          dynamicAttributes: this.buildDynamicAttributesPayload(this.dynamicEntries)
        }));
        this.message = 'Employee saved successfully.';
      }

      this.resetCreateForm();
      this.loadEmployees();
    } catch (error: any) {
      if (error?.status === 409) {
        this.message = typeof error.error === 'string' ? error.error : 'Employee code already exists.';
      } else {
        this.message = this.editingEmployeeId ? 'Failed to update employee.' : 'Failed to save employee.';
      }
    } finally {
      this.saving = false;
    }
  }

  startEdit(employee: Employee): void {
    this.editingEmployeeId = employee.id;
    this.isEmployeeCodeDuplicate = false;
    this.employeeCode = employee.employeeCode;
    this.fullName = employee.fullName;
    this.email = employee.email ?? '';
    this.phone = employee.phone ?? '';
    this.department = employee.department ?? '';
    this.designation = employee.designation ?? '';
    this.employmentStatus = employee.employmentStatus ?? '';
    this.address = employee.address ?? '';
    this.fatherName = employee.fatherName ?? '';
    this.motherName = employee.motherName ?? '';
    this.spouseName = employee.spouseName ?? '';
    this.fatherPhone = employee.fatherPhone ?? '';
    this.motherPhone = employee.motherPhone ?? '';
    this.spousePhone = employee.spousePhone ?? '';
    this.gender = employee.gender ?? '';
    this.religion = employee.religion ?? '';
    this.maritalStatus = employee.maritalStatus ?? '';
    this.bloodGroup = employee.bloodGroup ?? '';
    this.nationalId = employee.nationalId ?? '';
    this.photoBase64 = employee.photoBase64 ?? null;
    this.signatureBase64 = employee.signatureBase64 ?? null;
    this.workingTime = employee.workingTime ?? '';
    this.salaryRule = employee.salaryRule ?? '';
    this.grossSalary = employee.grossSalary ?? null;
    this.basicSalary = employee.basicSalary ?? null;
    this.weekend = employee.weekend ?? '';
    this.salaryAccount = employee.salaryAccount ?? '';
    this.dateOfBirth = employee.dateOfBirth ?? '';
    this.joiningDate = employee.joiningDate;
    if (this.workingTime && !this.shifts.some(x => x.name.toLowerCase() === this.workingTime.toLowerCase())) {
      this.shifts = [...this.shifts, { id: `legacy-${employee.id}`, name: this.workingTime }]
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (this.employmentStatus && !this.statusOptions.some(x => x.toLowerCase() === this.employmentStatus.toLowerCase())) {
      this.statusOptions = [...this.statusOptions, this.employmentStatus].sort((a, b) => a.localeCompare(b));
    }
    this.dynamicEntries = Object.entries(employee.dynamicAttributes).map(([key, value]) => ({
      key,
      value: value ?? ''
    }));
    if (this.dynamicEntries.length === 0) {
      this.dynamicEntries.push({ key: '', value: '' });
    }
    this.attributeSuggestionsByRow = {};
    this.dynamicEntries.forEach((_, index) => this.onAttributeKeyInput(index));
    this.message = `Editing employee: ${employee.fullName}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetCreateForm();
    this.message = 'Edit canceled.';
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
    if (this.isEditEmployeeCodeDuplicate) {
      this.message = 'Please use a unique employee code.';
      return;
    }
    if (this.editEmployeeCode === null || this.editEmployeeCode === undefined || !this.editFullName.trim() || !this.editJoiningDate || !this.editPhone.trim() || !this.editEmploymentStatus.trim()) {
      this.message = 'Employee code, name, joining date, phone and status are required.';
      return;
    }
    if (!this.isEmailValid(this.editEmail)) {
      this.message = 'Please enter a valid email format.';
      return;
    }
    if (!this.isPhoneValid(this.editPhone)) {
      this.message = 'Phone number must be at least 10 digits and contain only numbers.';
      return;
    }
    if (this.isDateInFuture(this.editDateOfBirth)) {
      this.message = 'Date of birth cannot be after current date.';
      return;
    }
    if (this.isUnderMinimumAge(this.editDateOfBirth)) {
      this.message = `Minimum age is ${this.minimumAgeYears} years.`;
      return;
    }

    try {
      await firstValueFrom(this.employeeService.update(employee.id, {
        employeeCode: this.editEmployeeCode!,
        fullName: this.editFullName.trim(),
        email: this.editEmail.trim() || null,
        phone: this.editPhone.trim() || null,
        department: this.editDepartment.trim() || null,
        designation: this.editDesignation.trim() || null,
        employmentStatus: this.editEmploymentStatus.trim() || null,
        address: this.editAddress.trim() || null,
        fatherName: this.editFatherName.trim() || null,
        motherName: this.editMotherName.trim() || null,
        spouseName: this.editSpouseName.trim() || null,
        fatherPhone: this.editFatherPhone.trim() || null,
        motherPhone: this.editMotherPhone.trim() || null,
        spousePhone: this.editSpousePhone.trim() || null,
        gender: this.editGender.trim() || null,
        religion: this.editReligion.trim() || null,
        maritalStatus: this.editMaritalStatus.trim() || null,
        bloodGroup: this.editBloodGroup.trim() || null,
        nationalId: this.editNationalId.trim() || null,
        photoBase64: this.editPhotoBase64,
        signatureBase64: this.editSignatureBase64,
        workingTime: this.editWorkingTime.trim() || null,
        salaryRule: this.editSalaryRule.trim() || null,
        grossSalary: this.normalizeOptionalNumber(this.editGrossSalary),
        basicSalary: this.normalizeOptionalNumber(this.editBasicSalary),
        weekend: this.editWeekend.trim() || null,
        salaryAccount: this.editSalaryAccount.trim() || null,
        dateOfBirth: this.editDateOfBirth || null,
        joiningDate: this.editJoiningDate
      }));

      await firstValueFrom(this.employeeService.replaceDynamicAttributes(
        employee.id,
        this.buildDynamicAttributesPayload(this.editDynamicEntries)
      ));

      this.message = 'Employee updated successfully.';
      this.cancelEdit();
      this.loadEmployees();
    } catch (error: any) {
      if (error.status === 409) {
        this.message = typeof error.error === 'string' ? error.error : 'Employee code already exists.';
      } else {
        this.message = 'Failed to update employee.';
      }
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
        if (this.employees.length === 1 && this.page > 1) {
          this.page -= 1;
        }
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
    this.loadingEmployees = true;
    this.employeeService.getAll({
      page: this.page,
      pageSize: this.pageSize,
      search: this.searchText,
      department: this.filterDepartment,
      designation: this.filterDesignation,
      joiningDateFrom: this.filterJoiningDateFrom,
      joiningDateTo: this.filterJoiningDateTo
    }).subscribe({
      next: (data) => {
        this.employees = data.items;
        this.totalCount = data.totalCount;
        this.page = data.page;
        this.pageSize = data.pageSize;
        this.totalPages = data.totalPages;
      },
      error: (error) => {
        const apiMessage = typeof error?.error === 'string' ? error.error : null;
        this.message = apiMessage ?? 'Failed to load employees.';
        this.loadingEmployees = false;
      },
      complete: () => {
        this.loadingEmployees = false;
      }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.hasRequestedEmployees = true;
    this.loadEmployees();
  }

  resetFilters(): void {
    this.searchText = '';
    this.filterDepartment = '';
    this.filterDesignation = '';
    this.filterJoiningDateFrom = '';
    this.filterJoiningDateTo = '';
    this.pageSize = 20;
    this.page = 1;
    this.hasRequestedEmployees = false;
    this.employees = [];
    this.totalCount = 0;
    this.totalPages = 0;
    this.loadingEmployees = false;
  }

  onPageSizeChange(pageSize: string | number): void {
    const parsed = Number(pageSize);
    this.pageSize = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
    this.page = 1;
    this.loadEmployees();
  }

  goToPage(pageNumber: number): void {
    if (pageNumber < 1 || (this.totalPages > 0 && pageNumber > this.totalPages) || pageNumber === this.page) {
      return;
    }

    this.page = pageNumber;
    this.loadEmployees();
  }

  downloadEmployees(): void {
    if (this.exporting) {
      return;
    }

    this.exporting = true;
    this.employeeService.export({
      search: this.searchText,
      department: this.filterDepartment,
      designation: this.filterDesignation,
      joiningDateFrom: this.filterJoiningDateFrom,
      joiningDateTo: this.filterJoiningDateTo
    }).subscribe({
      next: (blob) => {
        const timestamp = this.buildExportTimestamp();
        const fileName = `employees_${timestamp}.csv`;
        this.saveBlob(blob, fileName);
      },
      error: (error) => {
        const apiMessage = typeof error?.error === 'string' ? error.error : null;
        this.message = apiMessage ?? 'Failed to export employees.';
      },
      complete: () => {
        this.exporting = false;
      }
    });
  }

  openCsvUpdateModal(): void {
    if (!this.importingCsv && !this.isCsvBackgroundJobActive) {
      this.csvImportStatusMessage = '';
      this.csvImportErrors = [];
      this.showCsvUploadModal = true;
      this.csvDragOver = false;
    }
  }

  closeCsvUploadModal(): void {
    if (!this.importingCsv) {
      this.showCsvUploadModal = false;
      this.csvDragOver = false;
    }
  }

  onCsvUploadDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.importingCsv) {
      this.csvDragOver = true;
    }
  }

  onCsvUploadDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.csvDragOver = false;
  }

  onCsvUploadDrop(event: DragEvent): void {
    event.preventDefault();
    this.csvDragOver = false;
    if (this.importingCsv) {
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    this.importEmployeesFromCsv(file);
  }

  onCsvUpdateFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.importingCsv) {
      input.value = '';
      return;
    }

    this.importEmployeesFromCsv(file, input);
  }

  private importEmployeesFromCsv(file: File, input?: HTMLInputElement): void {
    this.csvImportStatusMessage = '';
    this.csvImportErrors = [];

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      this.csvImportStatusMessage = 'CSV upload failed.';
      this.csvImportErrors = ['Please choose a CSV file.'];
      if (input) {
        input.value = '';
      }
      return;
    }

    this.importingCsv = true;
    this.employeeService.importUpdateCsvInBackground(file).pipe(
      finalize(() => {
        this.importingCsv = false;
        if (input) {
          input.value = '';
        }
      })
    ).subscribe({
      next: (accepted) => {
        this.csvBackgroundJobId = accepted.jobId;
        this.csvBackgroundJobStatus = accepted.status;
        this.csvBackgroundJobPercent = 0;
        this.showCsvFloatingBadge = true;
        this.csvImportStatusMessage = accepted.message || 'CSV file accepted. Processing in background.';
        this.csvImportErrors = [];
        this.message = this.csvImportStatusMessage;
        this.showCsvUploadModal = false;
        this.startCsvJobPolling(accepted.jobId);
      },
      error: (error) => {
        const apiError = error?.error;
        if (apiError && typeof apiError === 'object') {
          this.csvImportStatusMessage = typeof apiError.message === 'string'
            ? apiError.message
            : 'CSV upload failed.';
          const errors = Array.isArray(apiError.errors) ? apiError.errors : [];
          this.csvImportErrors = errors.length > 0 ? errors : ['Failed to update employees from CSV.'];
        } else {
          const apiMessage = typeof apiError === 'string' ? apiError : null;
          this.csvImportStatusMessage = 'CSV upload failed.';
          this.csvImportErrors = [apiMessage ?? 'Failed to update employees from CSV.'];
        }

        this.message = `${this.csvImportStatusMessage} ${this.csvImportErrors[0] ?? ''}`.trim();
      }
    });
  }

  private startCsvJobPolling(jobId: string): void {
    this.stopCsvJobPolling();

    this.csvJobPollingSub = interval(300).pipe(
      startWith(0),
      switchMap(() => this.employeeService.getImportUpdateCsvJobStatus(jobId)),
      takeWhile((status) => status.status !== 'Completed' && status.status !== 'Failed', true)
    ).subscribe({
      next: (status) => this.handleCsvJobStatus(status),
      error: () => {
        this.csvImportStatusMessage = 'Unable to check CSV background job status.';
        this.csvImportErrors = ['Please refresh and check employee list after some time.'];
        this.message = this.csvImportStatusMessage;
        this.stopCsvJobPolling();
      }
    });
  }

  private handleCsvJobStatus(status: EmployeeCsvImportJobStatus): void {
    this.csvBackgroundJobStatus = status.status;
    this.csvBackgroundJobPercent = status.progressPercent
      ?? (status.totalRows && status.processedRows !== undefined && status.processedRows !== null
        ? Math.min(100, Math.round((status.processedRows / status.totalRows) * 100))
        : this.csvBackgroundJobPercent);

    if (status.status === 'Completed' || status.status === 'Failed' || status.status === 'Canceled') {
      const result = status.result;
      this.csvImportStatusMessage = result?.message || status.message || `CSV background job ${status.status.toLowerCase()}.`;
      this.csvImportErrors = result?.errors ?? [];
      this.message = this.csvImportStatusMessage;
      this.csvBackgroundJobStatus = status.status;
      if (status.status === 'Completed') {
        this.csvBackgroundJobPercent = 100;
      }
      this.stopCsvJobPolling();
      this.hasRequestedEmployees = true;
      this.loadEmployees();
      return;
    }

    this.csvImportStatusMessage = status.message || `CSV background job status: ${status.status}`;
    this.message = this.csvImportStatusMessage;
  }

  private stopCsvJobPolling(): void {
    if (this.csvJobPollingSub) {
      this.csvJobPollingSub.unsubscribe();
      this.csvJobPollingSub = null;
    }
  }

  closeCsvFloatingBadge(): void {
    this.showCsvFloatingBadge = false;
  }

  cancelCsvBackgroundJob(): void {
    if (!this.csvBackgroundJobId || !this.isCsvBackgroundJobActive) {
      return;
    }

    this.employeeService.cancelImportUpdateCsvJob(this.csvBackgroundJobId).subscribe({
      next: (status) => {
        this.handleCsvJobStatus(status);
        this.csvImportStatusMessage = status.message || 'CSV cancel requested.';
        this.message = this.csvImportStatusMessage;
        if (status.status === 'Canceled') {
          this.stopCsvJobPolling();
        }
      },
      error: () => {
        this.csvImportStatusMessage = 'Failed to request CSV cancellation.';
        this.message = this.csvImportStatusMessage;
      }
    });
  }

  get isCsvBackgroundJobActive(): boolean {
    return this.csvBackgroundJobStatus === 'Queued' || this.csvBackgroundJobStatus === 'Running';
  }

  get hasPreviousPage(): boolean {
    return this.page > 1;
  }

  get hasNextPage(): boolean {
    return this.totalPages > 0 && this.page < this.totalPages;
  }

  get pageStartIndex(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return (this.page - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  trackByEmployeeId(_: number, employee: Employee): string {
    return employee.id;
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

    this.lookupService.getShifts().subscribe({
      next: (items) => {
        this.shifts = items;
      }
    });

    this.employeeService.getStatusOptions().subscribe({
      next: (items) => {
        this.statusOptions = items;
        if (!this.employmentStatus && this.statusOptions.length > 0) {
          this.employmentStatus = this.statusOptions[0];
        }
        if (this.editingEmployeeId && !this.editEmploymentStatus && this.statusOptions.length > 0) {
          this.editEmploymentStatus = this.statusOptions[0];
        }
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
    this.editingEmployeeId = null;
    this.employeeCode = null;
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.department = '';
    this.designation = '';
    this.employmentStatus = this.statusOptions[0] ?? '';
    this.address = '';
    this.fatherName = '';
    this.motherName = '';
    this.spouseName = '';
    this.fatherPhone = '';
    this.motherPhone = '';
    this.spousePhone = '';
    this.gender = '';
    this.religion = '';
    this.maritalStatus = '';
    this.bloodGroup = '';
    this.nationalId = '';
    this.photoBase64 = null;
    this.signatureBase64 = null;
    this.workingTime = '';
    this.salaryRule = '';
    this.grossSalary = null;
    this.basicSalary = null;
    this.weekend = '';
    this.salaryAccount = '';
    this.dateOfBirth = '';
    this.joiningDate = '';
    this.dynamicEntries = [{ key: '', value: '' }];
    this.attributeSuggestionsByRow = {};
    this.isEmployeeCodeDuplicate = false;
    this.isEditEmployeeCodeDuplicate = false;
    this.onAttributeKeyInput(0);
  }

  isCreateEmailInvalid(): boolean {
    return !!this.email.trim() && !this.isEmailValid(this.email);
  }

  isEditEmailInvalid(): boolean {
    return !!this.editEmail.trim() && !this.isEmailValid(this.editEmail);
  }

  isCreatePhoneInvalid(): boolean {
    return !!this.phone.trim() && !this.isPhoneValid(this.phone);
  }

  isEditPhoneInvalid(): boolean {
    return !!this.editPhone.trim() && !this.isPhoneValid(this.editPhone);
  }

  isCreateDobFuture(): boolean {
    return this.isDateInFuture(this.dateOfBirth);
  }

  isEditDobFuture(): boolean {
    return this.isDateInFuture(this.editDateOfBirth);
  }

  isCreateDobUnderMinimumAge(): boolean {
    return this.isUnderMinimumAge(this.dateOfBirth);
  }

  isEditDobUnderMinimumAge(): boolean {
    return this.isUnderMinimumAge(this.editDateOfBirth);
  }

  get maxAllowedDate(): string {
    return this.toIsoDate(this.getTodayDateOnly());
  }

  get addDepartmentValue(): string {
    return this.addDepartmentOption;
  }

  get addDesignationValue(): string {
    return this.addDesignationOption;
  }

  get addStatusValue(): string {
    return this.addStatusOption;
  }

  get addShiftValue(): string {
    return this.addShiftOption;
  }

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly lookupService: LookupService,
    private readonly shiftService: ShiftService
  ) {}

  getEmployeePhotoSrc(employee: Employee): string | null {
    return this.resolveEmployeeImageSource(employee.photoBase64);
  }

  getEmployeeSignatureSrc(employee: Employee): string | null {
    return this.resolveEmployeeImageSource(employee.signatureBase64);
  }

  getEmployeeStatusClass(status?: string | null): string {
    const normalized = (status ?? '').trim().toLowerCase();

    if (normalized === 'active') {
      return 'status-active';
    }

    if (normalized === 'inactive') {
      return 'status-inactive';
    }

    if (normalized === 'close' || normalized === 'closed') {
      return 'status-closed';
    }

    if (normalized === 'resigned') {
      return 'status-resigned';
    }

    return 'status-default';
  }

  getShiftHourPart(timeValue: string | null | undefined): string {
    return this.parseShiftTimeParts(timeValue).hour;
  }

  getShiftMinutePart(timeValue: string | null | undefined): string {
    return this.parseShiftTimeParts(timeValue).minute;
  }

  getShiftMeridiemPart(timeValue: string | null | undefined): Meridiem {
    return this.parseShiftTimeParts(timeValue).meridiem;
  }

  updateShiftHourPart(currentValue: string, hour: string): string {
    return this.updateShiftTimePart(currentValue, { hour });
  }

  updateShiftMinutePart(currentValue: string, minute: string): string {
    return this.updateShiftTimePart(currentValue, { minute });
  }

  updateShiftMeridiemPart(currentValue: string, meridiem: Meridiem): string {
    return this.updateShiftTimePart(currentValue, { meridiem });
  }

  private isEmailValid(email: string): boolean {
    const trimmed = email.trim();
    return !trimmed || this.emailRegex.test(trimmed);
  }

  private isPhoneValid(phone: string): boolean {
    const trimmed = phone.trim();
    return !trimmed || this.phoneRegex.test(trimmed);
  }

  formatDisplayDate(value?: string | null): string {
    const parsed = this.parseDateOnly(value);
    if (!parsed) {
      return '-';
    }

    const day = parsed.getDate().toString().padStart(2, '0');
    const month = this.monthNames[parsed.getMonth()];
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  getCurrentAge(value?: string | null): string {
    const dob = this.parseDateOnly(value);
    if (!dob) {
      return '-';
    }

    const today = this.getTodayDateOnly();
    const duration = this.getDuration(dob, today);
    if (!duration) {
      return 'Invalid DOB';
    }

    return `${duration.years} years - ${duration.months} months - ${duration.days} days`;
  }

  getLengthOfService(value?: string | null): string {
    const joining = this.parseDateOnly(value);
    if (!joining) {
      return '-';
    }

    const today = this.getTodayDateOnly();
    const duration = this.getDuration(joining, today);
    if (!duration) {
      return 'Not started yet';
    }

    return `${duration.years} years - ${duration.months} months - ${duration.days} days`;
  }

  private parseDateOnly(value?: string | null): Date | null {
    const source = value?.trim();
    if (!source) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  private getTodayDateOnly(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private getDuration(from: Date, to: Date): { years: number; months: number; days: number } | null {
    if (from > to) {
      return null;
    }

    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();

    if (days < 0) {
      months -= 1;
      const previousMonth = to.getMonth() === 0 ? 11 : to.getMonth() - 1;
      const previousMonthYear = to.getMonth() === 0 ? to.getFullYear() - 1 : to.getFullYear();
      days += this.getDaysInMonth(previousMonthYear, previousMonth);
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months, days };
  }

  private getDaysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  private isDateInFuture(value?: string | null): boolean {
    const date = this.parseDateOnly(value);
    if (!date) {
      return false;
    }

    return date > this.getTodayDateOnly();
  }

  private isUnderMinimumAge(value?: string | null): boolean {
    const dob = this.parseDateOnly(value);
    if (!dob) {
      return false;
    }

    const duration = this.getDuration(dob, this.getTodayDateOnly());
    if (!duration) {
      return false;
    }

    return duration.years < this.minimumAgeYears;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeOptionalNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeShiftTime(timeValue: string | null | undefined): string {
    if (!timeValue) {
      return '';
    }

    return timeValue.trim().slice(0, 5);
  }

  private parseShiftTimeParts(timeValue: string | null | undefined): { hour: string; minute: string; meridiem: Meridiem } {
    const normalized = this.normalizeShiftTime(timeValue);
    if (!normalized) {
      return { hour: '', minute: '', meridiem: 'AM' };
    }

    const [hourText, minuteText] = normalized.split(':');
    const hour24 = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour24) || !Number.isFinite(minute)) {
      return { hour: '', minute: '', meridiem: 'AM' };
    }

    const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return {
      hour: hour12.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      meridiem
    };
  }

  private updateShiftTimePart(
    currentValue: string | null | undefined,
    patch: Partial<{ hour: string; minute: string; meridiem: Meridiem }>
  ): string {
    const current = this.parseShiftTimeParts(currentValue);
    let nextHour = patch.hour ?? current.hour ?? '';
    let nextMinute = patch.minute ?? current.minute ?? '';
    const nextMeridiem = patch.meridiem ?? current.meridiem ?? 'AM';

    // Allow selection in any order:
    // if user picks hour first, use 00 minute; if user picks minute first, use 12 hour.
    if (!nextMinute && patch.hour !== undefined) {
      nextMinute = '00';
    }
    if (!nextHour && patch.minute !== undefined) {
      nextHour = '12';
    }

    if (!nextHour || !nextMinute) {
      return '';
    }

    const hour12 = Number(nextHour);
    const minute = Number(nextMinute);
    if (!Number.isFinite(hour12) || !Number.isFinite(minute) || hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
      return '';
    }

    const hour24 = nextMeridiem === 'PM'
      ? (hour12 % 12) + 12
      : hour12 % 12;

    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private isMaternityStatusInvalidForGender(status?: string | null, gender?: string | null): boolean {
    const normalizedStatus = (status ?? '').trim().toLowerCase();
    const normalizedGender = (gender ?? '').trim().toLowerCase();
    return normalizedStatus === 'maternity' && normalizedGender !== 'female';
  }

  private buildExportTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${sec}`;
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  private resolveEmployeeImageSource(value?: string | null): string | null {
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

    // Convert to grayscale first.
    const gray = new Uint8ClampedArray(pixelCount);
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const red = pixels[p];
      const green = pixels[p + 1];
      const blue = pixels[p + 2];
      gray[i] = Math.round((0.299 * red) + (0.587 * green) + (0.114 * blue));
    }

    // Build integral image for fast local mean calculation.
    const stride = width + 1;
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 1; y <= height; y++) {
      let rowSum = 0;
      for (let x = 1; x <= width; x++) {
        rowSum += gray[(y - 1) * width + (x - 1)];
        integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
      }
    }

    // Adaptive threshold to handle uneven lighting/shadows on paper.
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

    // Remove isolated noise pixels.
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

    // Render clean black ink on white background.
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

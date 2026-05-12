import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';
import { EmployeeService } from '../../services/employee.service';
import { Employee } from '../../models/employee.model';
import { LookupItem } from '../../models/lookup.model';
import { LookupService } from '../../services/lookup.service';
import { ShiftService } from '../../services/shift.service';

@Component({
  selector: 'app-employee-info',
  imports: [CommonModule, FormsModule, ImageCropperComponent],
  templateUrl: './employee-info.component.html',
  styleUrl: './employee-info.component.scss'
})
export class EmployeeInfoComponent implements OnInit {
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
    this.loadEmployees();
    this.loadLookups();
    this.onAttributeKeyInput(0);
  }

  checkCode(): void {
    const code = this.employeeCode;
    if (code === null || code === undefined) {
      this.isEmployeeCodeDuplicate = false;
      return;
    }

    this.employeeService.checkEmployeeCode(code).subscribe({
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

  imageCropped(event: ImageCroppedEvent) {
    console.log('Image cropped event fired', event);
    if (event.base64) {
      this.croppedImage = event.base64;
    } else if (event.objectUrl) {
      // Fallback if base64 is not provided for some reason
      this.croppedImage = event.objectUrl;
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

  applyCrop(): void {
    console.log('Applying crop for:', this.croppingFor, 'isEdit:', this.isEditMode);
    console.log('Cropped image length:', this.croppedImage?.length);

    if (!this.croppedImage) {
      this.message = 'Processing image, please wait a moment...';
      return;
    }

    if (this.isEditMode) {
      if (this.croppingFor === 'photo') {
        this.editPhotoBase64 = this.croppedImage;
      } else {
        this.editSignatureBase64 = this.croppedImage;
      }
    } else {
      if (this.croppingFor === 'photo') {
        this.photoBase64 = this.croppedImage;
      } else {
        this.signatureBase64 = this.croppedImage;
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

    if (!this.newShiftInTime || !this.newShiftOutTime || !this.newShiftInTimeGrace || !this.newShiftOutTimeGrace || !this.newShiftBreakStartTime || !this.newShiftBreakEndTime) {
      this.message = 'All shift time fields are required.';
      return;
    }

    this.shiftService.create({
      name,
      inTime: this.newShiftInTime,
      outTime: this.newShiftOutTime,
      inTimeGrace: this.newShiftInTimeGrace,
      outTimeGrace: this.newShiftOutTimeGrace,
      breakStartTime: this.newShiftBreakStartTime,
      breakEndTime: this.newShiftBreakEndTime
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

  saveEmployee(): void {
    if (this.isEmployeeCodeDuplicate) {
      this.message = 'Please use a unique employee code.';
      return;
    }
    if (this.employeeCode === null || this.employeeCode === undefined || !this.fullName.trim() || !this.joiningDate || !this.phone.trim() || !this.employmentStatus.trim()) {
      this.message = 'Employee code, name, joining date, phone and status are required.';
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

    this.saving = true;
    this.employeeService.create({
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
      joiningDate: this.joiningDate,
      dynamicAttributes: this.buildDynamicAttributesPayload(this.dynamicEntries)
    }).subscribe({
      next: () => {
        this.message = 'Employee saved successfully.';
        this.resetCreateForm();
        this.loadEmployees();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 409) {
          this.message = typeof error.error === 'string' ? error.error : 'Employee code already exists.';
        } else {
          this.message = 'Failed to save employee.';
        }
        this.saving = false;
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  startEdit(employee: Employee): void {
    this.editingEmployeeId = employee.id;
    this.isEditEmployeeCodeDuplicate = false;
    this.editEmployeeCode = employee.employeeCode;
    this.editFullName = employee.fullName;
    this.editEmail = employee.email ?? '';
    this.editPhone = employee.phone ?? '';
    this.editDepartment = employee.department ?? '';
    this.editDesignation = employee.designation ?? '';
    this.editEmploymentStatus = employee.employmentStatus ?? '';
    this.editAddress = employee.address ?? '';
    this.editFatherName = employee.fatherName ?? '';
    this.editMotherName = employee.motherName ?? '';
    this.editSpouseName = employee.spouseName ?? '';
    this.editFatherPhone = employee.fatherPhone ?? '';
    this.editMotherPhone = employee.motherPhone ?? '';
    this.editSpousePhone = employee.spousePhone ?? '';
    this.editGender = employee.gender ?? '';
    this.editReligion = employee.religion ?? '';
    this.editMaritalStatus = employee.maritalStatus ?? '';
    this.editBloodGroup = employee.bloodGroup ?? '';
    this.editNationalId = employee.nationalId ?? '';
    this.editPhotoBase64 = employee.photoBase64 ?? null;
    this.editSignatureBase64 = employee.signatureBase64 ?? null;
    this.editWorkingTime = employee.workingTime ?? '';
    this.editSalaryRule = employee.salaryRule ?? '';
    this.editGrossSalary = employee.grossSalary ?? null;
    this.editBasicSalary = employee.basicSalary ?? null;
    this.editWeekend = employee.weekend ?? '';
    this.editSalaryAccount = employee.salaryAccount ?? '';
    this.editDateOfBirth = employee.dateOfBirth ?? '';
    this.editJoiningDate = employee.joiningDate;
    if (this.editWorkingTime && !this.shifts.some(x => x.name.toLowerCase() === this.editWorkingTime.toLowerCase())) {
      this.shifts = [...this.shifts, { id: `legacy-${employee.id}`, name: this.editWorkingTime }]
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (this.editEmploymentStatus && !this.statusOptions.some(x => x.toLowerCase() === this.editEmploymentStatus.toLowerCase())) {
      this.statusOptions = [...this.statusOptions, this.editEmploymentStatus].sort((a, b) => a.localeCompare(b));
    }
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
    this.isEditEmployeeCodeDuplicate = false;
    this.editEmploymentStatus = '';
    this.editDateOfBirth = '';
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
    this.loadEmployees();
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
    this.employeeCode = null;
    this.fullName = '';
    this.email = '';
    this.phone = '';
    this.department = '';
    this.designation = '';
    this.employmentStatus = '';
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
}

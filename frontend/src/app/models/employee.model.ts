export interface Employee {
  id: string;
  employeeCode: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  department?: string | null;
  designationId?: string | null;
  designation?: string | null;
  address?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  spousePhone?: string | null;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  bloodGroup?: string | null;
  nationalId?: string | null;
  employmentStatus?: string | null;
  photoBase64?: string | null;
  signatureBase64?: string | null;
  shiftId?: string | null;
  workingTime?: string | null;
  salaryRule?: string | null;
  grossSalary?: number | null;
  basicSalary?: number | null;
  weekend?: string | null;
  salaryAccount?: string | null;
  dateOfBirth?: string | null;
  joiningDate: string;
  dynamicAttributes: Record<string, string | null>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface EmployeeSearchParams {
  page?: number;
  pageSize?: number;
  search?: string | null;
  department?: string | null;
  designation?: string | null;
  joiningDateFrom?: string | null;
  joiningDateTo?: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateEmployeeRequest {
  employeeCode: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  department?: string | null;
  designationId?: string | null;
  designation?: string | null;
  address?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  spousePhone?: string | null;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  bloodGroup?: string | null;
  nationalId?: string | null;
  employmentStatus?: string | null;
  photoBase64?: string | null;
  signatureBase64?: string | null;
  shiftId?: string | null;
  workingTime?: string | null;
  salaryRule?: string | null;
  grossSalary?: number | null;
  basicSalary?: number | null;
  weekend?: string | null;
  salaryAccount?: string | null;
  dateOfBirth?: string | null;
  joiningDate: string;
  dynamicAttributes: Record<string, string | null>;
}

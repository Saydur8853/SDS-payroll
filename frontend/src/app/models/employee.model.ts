export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  address?: string | null;
  joiningDate: string;
  dynamicAttributes: Record<string, string | null>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateEmployeeRequest {
  employeeCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  address?: string | null;
  joiningDate: string;
  dynamicAttributes: Record<string, string | null>;
}

export interface Authorizer {
  id: string;
  name: string;
  designationId?: string | null;
  designation: string;
  departmentId?: string | null;
  department: string;
  photoBase64?: string | null;
  signatureBase64?: string | null;
  pinPassword: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateAuthorizerRequest {
  name: string;
  designationId?: string | null;
  designation: string;
  departmentId?: string | null;
  department: string;
  photoBase64?: string | null;
  signatureBase64?: string | null;
  pinPassword: string;
}

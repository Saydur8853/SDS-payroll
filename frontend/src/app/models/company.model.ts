export interface Company {
  id: string;
  name: string;
  address: string;
  logoUrl?: string | null;
  logoBase64?: string | null;
  dynamicAttributes: Record<string, string | null>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateCompanyRequest {
  name: string;
  address: string;
  logoUrl?: string | null;
  logoBase64?: string | null;
  dynamicAttributes: Record<string, string | null>;
}

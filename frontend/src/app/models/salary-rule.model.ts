export interface SalaryRule {
  id: string;
  ruleName: string;
  basicSalary: number;
  houseRent: number;
  medicalBill: number;
  transportBill: number;
  foodAllowance: number;
  dynamicAttributes: Record<string, string | null>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SalaryRuleUpsertRequest {
  ruleName: string;
  basicSalary: number;
  houseRent: number;
  medicalBill: number;
  transportBill: number;
  foodAllowance: number;
  dynamicAttributes: Record<string, string>;
}

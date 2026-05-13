export interface Shift {
  id: string;
  name: string;
  inTime: string | null;
  outTime: string | null;
  inTimeGrace: string | null;
  outTimeGrace: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  displayName: string;
  temporaryOverrides: ShiftTemporaryOverride[];
}

export interface ShiftUpsertRequest {
  name: string;
  inTime: string;
  outTime: string;
  inTimeGrace: string;
  outTimeGrace: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
}

export interface ShiftTemporaryOverride {
  id: string;
  shiftId: string;
  dateFrom: string;
  dateTo: string;
  inTime?: string | null;
  outTime?: string | null;
  reason?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ShiftTemporaryOverrideUpsertRequest {
  dateFrom: string;
  dateTo: string;
  inTime?: string | null;
  outTime?: string | null;
  reason?: string | null;
  isActive: boolean;
}

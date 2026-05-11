export interface Shift {
  id: string;
  name: string;
  inTime: string;
  outTime: string;
  inTimeGrace: string;
  outTimeGrace: string;
  breakStartTime: string;
  breakEndTime: string;
  displayName: string;
}

export interface ShiftUpsertRequest {
  name: string;
  inTime: string;
  outTime: string;
  inTimeGrace: string;
  outTimeGrace: string;
  breakStartTime: string;
  breakEndTime: string;
}

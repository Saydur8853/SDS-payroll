export interface Announcement {
  id: string;
  title: string;
  message: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface AnnouncementUpsertRequest {
  title: string;
  message: string;
  isActive: boolean;
}

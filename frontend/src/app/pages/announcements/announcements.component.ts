import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Announcement } from '../../models/announcement.model';
import { AnnouncementService } from '../../services/announcement.service';

@Component({
  selector: 'app-announcements',
  imports: [CommonModule, FormsModule],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent implements OnInit {
  announcements: Announcement[] = [];
  title = '';
  message = '';
  isActive = true;
  editingId: string | null = null;
  editTitle = '';
  editMessage = '';
  editIsActive = true;
  feedback = '';
  isSaving = false;
  deletingId: string | null = null;

  constructor(private readonly announcementService: AnnouncementService) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    const title = this.title.trim();
    const message = this.message.trim();
    if (!title || !message) {
      this.feedback = 'Title and message are required.';
      return;
    }

    this.isSaving = true;
    this.announcementService.create({ title, message, isActive: this.isActive }).subscribe({
      next: () => {
        this.title = '';
        this.message = '';
        this.isActive = true;
        this.feedback = 'Announcement posted.';
        this.isSaving = false;
        this.announcementService.notifyChanged();
        this.load();
      },
      error: () => {
        this.feedback = 'Failed to post announcement.';
        this.isSaving = false;
      }
    });
  }

  startEdit(announcement: Announcement): void {
    this.editingId = announcement.id;
    this.editTitle = announcement.title;
    this.editMessage = announcement.message;
    this.editIsActive = announcement.isActive;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editTitle = '';
    this.editMessage = '';
    this.editIsActive = true;
  }

  saveEdit(announcement: Announcement): void {
    const title = this.editTitle.trim();
    const message = this.editMessage.trim();
    if (!title || !message) {
      this.feedback = 'Title and message are required.';
      return;
    }

    this.isSaving = true;
    this.announcementService.update(announcement.id, { title, message, isActive: this.editIsActive }).subscribe({
      next: () => {
        this.feedback = 'Announcement updated.';
        this.isSaving = false;
        this.cancelEdit();
        this.announcementService.notifyChanged();
        this.load();
      },
      error: () => {
        this.feedback = 'Failed to update announcement.';
        this.isSaving = false;
      }
    });
  }

  delete(announcement: Announcement): void {
    if (!confirm(`Delete announcement "${announcement.title}"?`)) {
      return;
    }

    this.deletingId = announcement.id;
    this.announcementService.delete(announcement.id).subscribe({
      next: () => {
        this.feedback = 'Announcement deleted.';
        this.deletingId = null;
        this.announcementService.notifyChanged();
        this.load();
      },
      error: () => {
        this.feedback = 'Failed to delete announcement.';
        this.deletingId = null;
      }
    });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  trackById(_: number, announcement: Announcement): string {
    return announcement.id;
  }

  private load(): void {
    this.announcementService.getAll(true).subscribe({
      next: (announcements) => {
        this.announcements = announcements;
      },
      error: () => {
        this.feedback = 'Failed to load announcements.';
      }
    });
  }
}

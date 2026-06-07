import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Announcement } from '../../models/announcement.model';
import { AnnouncementService } from '../../services/announcement.service';

@Component({
  selector: 'app-common-header',
  imports: [CommonModule],
  templateUrl: './common-header.component.html',
  styleUrl: './common-header.component.scss'
})
export class CommonHeaderComponent implements OnInit, OnDestroy {
  private readonly lastSeenStorageKey = 'sds-payroll-announcements-last-seen';
  private announcementSubscription?: Subscription;

  announcements: Announcement[] = [];
  hasUnseenAnnouncements = false;
  isAnnouncementMenuOpen = false;
  isAnnouncementListExpanded = false;

  readonly secondaryActions = [
    {
      label: 'Accessibility',
      icon: 'accessibility_new'
    },
    {
      label: 'Info',
      icon: 'info'
    }
  ];

  get bulletinText(): string {
    return this.visibleAnnouncements
      .map((announcement) => `${announcement.title} : ${announcement.message}`)
      .join('   |   ');
  }

  get menuAnnouncements(): Announcement[] {
    return this.isAnnouncementListExpanded ? this.announcements : this.announcements.slice(0, 10);
  }

  get visibleAnnouncements(): Announcement[] {
    return this.announcements.filter((announcement) => announcement.isActive);
  }

  get hasMoreAnnouncements(): boolean {
    return this.announcements.length > 10 && !this.isAnnouncementListExpanded;
  }

  constructor(
    private readonly announcementService: AnnouncementService,
    private readonly elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.loadAnnouncements();
    this.announcementSubscription = this.announcementService.changed$.subscribe(() => {
      this.loadAnnouncements();
    });
  }

  ngOnDestroy(): void {
    this.announcementSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isAnnouncementMenuOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeAnnouncementMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAnnouncementMenu();
  }

  toggleAnnouncementMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAnnouncementMenuOpen = !this.isAnnouncementMenuOpen;

    if (this.isAnnouncementMenuOpen) {
      this.markAnnouncementsSeen();
    } else {
      this.isAnnouncementListExpanded = false;
    }
  }

  closeAnnouncementMenu(): void {
    this.isAnnouncementMenuOpen = false;
    this.isAnnouncementListExpanded = false;
  }

  formatAnnouncementDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private loadAnnouncements(): void {
    this.announcementService.getAll(true).subscribe({
      next: (announcements) => {
        this.announcements = announcements.sort(
          (first, second) => new Date(second.createdAtUtc).getTime() - new Date(first.createdAtUtc).getTime()
        );
        if (this.isAnnouncementMenuOpen) {
          this.markAnnouncementsSeen();
          return;
        }

        this.updateUnseenState();
      },
      error: () => {
        this.announcements = [];
        this.hasUnseenAnnouncements = false;
      }
    });
  }

  private updateUnseenState(): void {
    const latestCreatedAt = this.getLatestCreatedAt();
    if (!latestCreatedAt) {
      this.hasUnseenAnnouncements = false;
      return;
    }

    const lastSeen = localStorage.getItem(this.lastSeenStorageKey);
    const latestTime = new Date(latestCreatedAt).getTime();
    this.hasUnseenAnnouncements = !lastSeen || latestTime > new Date(lastSeen).getTime();
  }

  private markAnnouncementsSeen(): void {
    const latestCreatedAt = this.getLatestCreatedAt();
    if (latestCreatedAt) {
      localStorage.setItem(this.lastSeenStorageKey, latestCreatedAt);
    }

    this.hasUnseenAnnouncements = false;
  }

  private getLatestCreatedAt(): string | null {
    return this.announcements.reduce<string | null>((latest, announcement) => {
      if (!latest) {
        return announcement.createdAtUtc;
      }

      return new Date(announcement.createdAtUtc).getTime() > new Date(latest).getTime()
        ? announcement.createdAtUtc
        : latest;
    }, null);
  }

  showMoreAnnouncements(): void {
    this.isAnnouncementListExpanded = true;
  }
}

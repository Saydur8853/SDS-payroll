import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Subscription } from 'rxjs';
import { Announcement } from '../../models/announcement.model';
import { AnnouncementService } from '../../services/announcement.service';

interface FontOption {
  label: string;
  value: string;
  stack: string;
}

interface ThemeOption {
  label: string;
  value: 'dark' | 'light' | 'system';
  icon: string;
}

@Component({
  selector: 'app-common-header',
  imports: [CommonModule],
  templateUrl: './common-header.component.html',
  styleUrl: './common-header.component.scss'
})
export class CommonHeaderComponent implements OnInit, OnDestroy {
  private readonly lastSeenStorageKey = 'sds-payroll-announcements-last-seen';
  private readonly englishFontStorageKey = 'sds-payroll-english-font';
  private readonly banglaFontStorageKey = 'sds-payroll-bangla-font';
  private readonly themeStorageKey = 'sds-payroll-theme';
  private announcementSubscription?: Subscription;

  announcements: Announcement[] = [];
  hasUnseenAnnouncements = false;
  isAnnouncementMenuOpen = false;
  isAnnouncementListExpanded = false;
  isAccessibilityMenuOpen = false;
  accessibilityView: 'main' | 'font' | 'theme' = 'main';
  selectedEnglishFont = 'inter';
  selectedBanglaFont = 'noto-bengali';
  selectedTheme: ThemeOption['value'] = 'system';

  readonly englishFontOptions: FontOption[] = [
    {
      label: 'Inter',
      value: 'inter',
      stack: "'Inter'"
    },
    {
      label: 'Segoe UI',
      value: 'segoe',
      stack: "'Segoe UI'"
    },
    {
      label: 'Arial',
      value: 'arial',
      stack: 'Arial'
    },
    {
      label: 'Calibri',
      value: 'calibri',
      stack: 'Calibri'
    },
    {
      label: 'Roboto',
      value: 'roboto',
      stack: 'Roboto'
    },
    {
      label: 'Times New Roman',
      value: 'times-new-roman',
      stack: "'Times New Roman'"
    }
  ];

  readonly banglaFontOptions: FontOption[] = [
    {
      label: 'Noto Sans Bengali',
      value: 'noto-bengali',
      stack: "'Noto Sans Bengali'"
    },
    {
      label: 'SolaimanLipi',
      value: 'solaimanlipi',
      stack: 'SolaimanLipi'
    },
    {
      label: 'Kalpurush',
      value: 'kalpurush',
      stack: 'Kalpurush'
    },
    {
      label: 'SutonnyMJ',
      value: 'sutonnymj',
      stack: 'SutonnyMJ'
    },
    {
      label: 'Nikosh Bangla',
      value: 'nikosh-bangla',
      stack: "'Nikosh Bangla'"
    },
    {
      label: 'Tiro Bangla',
      value: 'tiro-bangla',
      stack: "'Tiro Bangla'"
    },
    {
      label: 'Hind Siliguri',
      value: 'hind-siliguri',
      stack: "'Hind Siliguri'"
    },
    {
      label: 'Anek Bangla',
      value: 'anek-bangla',
      stack: "'Anek Bangla'"
    }
  ];

  readonly themeOptions: ThemeOption[] = [
    {
      label: 'Dark',
      value: 'dark',
      icon: 'dark_mode'
    },
    {
      label: 'Light',
      value: 'light',
      icon: 'light_mode'
    },
    {
      label: 'System',
      value: 'system',
      icon: 'desktop_windows'
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
    private readonly elementRef: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private readonly documentRef: Document
  ) {}

  ngOnInit(): void {
    this.loadFontPreferences();
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
    if (!this.isAnnouncementMenuOpen && !this.isAccessibilityMenuOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeOpenMenus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeOpenMenus();
  }

  toggleAnnouncementMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAnnouncementMenuOpen = !this.isAnnouncementMenuOpen;

    if (this.isAnnouncementMenuOpen) {
      this.isAccessibilityMenuOpen = false;
      this.markAnnouncementsSeen();
    } else {
      this.isAnnouncementListExpanded = false;
    }
  }

  closeAnnouncementMenu(): void {
    this.isAnnouncementMenuOpen = false;
    this.isAnnouncementListExpanded = false;
  }

  toggleAccessibilityMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAccessibilityMenuOpen = !this.isAccessibilityMenuOpen;
    if (this.isAccessibilityMenuOpen) {
      this.closeAnnouncementMenu();
      this.accessibilityView = 'main';
    }
  }

  selectEnglishFont(value: string): void {
    this.selectedEnglishFont = value;
    localStorage.setItem(this.englishFontStorageKey, value);
    this.applyFontPreferences();
  }

  selectBanglaFont(value: string): void {
    this.selectedBanglaFont = value;
    localStorage.setItem(this.banglaFontStorageKey, value);
    this.applyFontPreferences();
  }

  resetFonts(): void {
    this.selectedEnglishFont = 'inter';
    this.selectedBanglaFont = 'noto-bengali';
    localStorage.removeItem(this.englishFontStorageKey);
    localStorage.removeItem(this.banglaFontStorageKey);
    this.applyFontPreferences();
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

  private closeOpenMenus(): void {
    this.closeAnnouncementMenu();
    this.isAccessibilityMenuOpen = false;
    this.accessibilityView = 'main';
  }

  private loadFontPreferences(): void {
    const englishFont = localStorage.getItem(this.englishFontStorageKey);
    const banglaFont = localStorage.getItem(this.banglaFontStorageKey);
    const theme = localStorage.getItem(this.themeStorageKey);

    if (englishFont && this.englishFontOptions.some((option) => option.value === englishFont)) {
      this.selectedEnglishFont = englishFont;
    }

    if (banglaFont && this.banglaFontOptions.some((option) => option.value === banglaFont)) {
      this.selectedBanglaFont = banglaFont;
    }

    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      this.selectedTheme = theme;
    }

    this.applyFontPreferences();
    this.applyThemePreference();
  }

  private applyFontPreferences(): void {
    const englishFont = this.englishFontOptions.find((option) => option.value === this.selectedEnglishFont) ?? this.englishFontOptions[0];
    const banglaFont = this.banglaFontOptions.find((option) => option.value === this.selectedBanglaFont) ?? this.banglaFontOptions[0];
    const root = this.documentRef.documentElement;

    root.style.setProperty('--app-english-font', englishFont.stack);
    root.style.setProperty('--app-bangla-font', banglaFont.stack);
    root.style.setProperty(
      '--app-font-family',
      `${englishFont.stack}, ${banglaFont.stack}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    );
  }

  openAccessibilityView(view: 'main' | 'font' | 'theme'): void {
    this.accessibilityView = view;
  }

  selectTheme(value: ThemeOption['value']): void {
    this.selectedTheme = value;
    localStorage.setItem(this.themeStorageKey, value);
    this.applyThemePreference();
  }

  private applyThemePreference(): void {
    const root = this.documentRef.documentElement;
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
    const effectiveTheme = this.selectedTheme === 'system'
      ? prefersLight ? 'light' : 'dark'
      : this.selectedTheme;

    root.dataset['theme'] = effectiveTheme;
    root.dataset['themePreference'] = this.selectedTheme;
  }
}

import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
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

interface ManualSection {
  heading: string;
  items: string[];
}

interface PageManual {
  title: string;
  subtitle: string;
  icon: string;
  sections: ManualSection[];
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
  private routerSubscription?: Subscription;

  announcements: Announcement[] = [];
  hasUnseenAnnouncements = false;
  isAnnouncementMenuOpen = false;
  isAnnouncementListExpanded = false;
  isAccessibilityMenuOpen = false;
  isInfoMenuOpen = false;
  accessibilityView: 'main' | 'font' | 'theme' = 'main';
  selectedEnglishFont = 'inter';
  selectedBanglaFont = 'noto-bengali';
  selectedTheme: ThemeOption['value'] = 'system';
  currentManual: PageManual;

  private readonly defaultManual: PageManual = {
    title: 'Page User Manual',
    subtitle: 'Quick guide for the current page.',
    icon: 'help',
    sections: [
      {
        heading: 'How to Use',
        items: [
          'Use the left menu to open a module.',
          'Use page buttons to add, update, export, or filter records.',
          'Press Esc to close open header menus.'
        ]
      }
    ]
  };

  private readonly manualByPath: Record<string, PageManual> = {
    dashboard: {
      title: 'Dashboard Manual',
      subtitle: 'Overview of company, employee, attendance, and setup totals.',
      icon: 'dashboard',
      sections: [
        {
          heading: 'Overview Cards',
          items: [
            'Review total companies, employees, departments, shifts, authorizers, and attendance punches.',
            'Use the date badge to confirm which day the dashboard summary represents.'
          ]
        },
        {
          heading: 'Quick Actions',
          items: [
            'Open each management page directly from the quick action shortcuts.',
            'Use Dashboard when you need a high-level system status before working in modules.'
          ]
        }
      ]
    },
    'employee-info': {
      title: 'Employee Info Manual',
      subtitle: 'Add employees, search records, filter lists, and manage imports or exports.',
      icon: 'groups',
      sections: [
        {
          heading: 'Add Employee',
          items: [
            'Fill required fields marked with a red asterisk before saving.',
            'Upload photo and signature from the upload buttons beside the basic information section.',
            'Use dropdown fields for company, department, designation, status, gender, religion, and other employee attributes.'
          ]
        },
        {
          heading: 'Search and Filter',
          items: [
            'Choose a search type, type in Search and filter, then press Apply.',
            'Open the filter button to use advanced employee filters.',
            'Press Esc after a search to reset the search and filter state.'
          ]
        },
        {
          heading: 'CSV and Paging',
          items: [
            'Use Save as CSV to export the current employee list.',
            'Use Update by CSV to upload employee updates in bulk.',
            'Change Per Page from the page navigation area, not from the filter drawer.'
          ]
        }
      ]
    },
    attendance: {
      title: 'Attendance Manual',
      subtitle: 'Load, upload, and review employee attendance data.',
      icon: 'fact_check',
      sections: [
        {
          heading: 'Common Parameters',
          items: [
            'Select the required company, date, or shared attendance parameters before loading data.',
            'Use Apply after changing parameters so the attendance list refreshes correctly.'
          ]
        },
        {
          heading: 'Upload Attendance',
          items: [
            'Use the upload panel to import attendance files.',
            'Confirm the selected file and parameters before processing an upload.'
          ]
        },
        {
          heading: 'Review Data',
          items: [
            'Use search and filters to narrow attendance records.',
            'Check imported records before using them for payroll processing.'
          ]
        }
      ]
    },
    announcements: {
      title: 'Announcements Manual',
      subtitle: 'Create announcement posts and control what appears in the header bulletin.',
      icon: 'campaign',
      sections: [
        {
          heading: 'Post Announcement',
          items: [
            'Enter a title and message, then click Post Announcement.',
            'Enable Visible in announcement menu when the post should scroll in the header bulletin.'
          ]
        },
        {
          heading: 'Header Announcement Button',
          items: [
            'The announcement button shows the latest announcements, newest first.',
            'A blinking red dot means there are unseen announcements.',
            'Use More inside the dropdown to reveal older posts when available.'
          ]
        },
        {
          heading: 'Manage Posts',
          items: [
            'Use Edit to update an announcement.',
            'Use Delete to remove an announcement from the system.'
          ]
        }
      ]
    },
    'company-info': {
      title: 'Company Info Manual',
      subtitle: 'Manage company profile records and related configuration.',
      icon: 'business',
      sections: [
        {
          heading: 'Company Records',
          items: [
            'Add company details carefully because other modules depend on company selection.',
            'Update company information when organization details change.'
          ]
        },
        {
          heading: 'Usage Notes',
          items: [
            'Departments, designations, employees, salary rules, and attendance are linked to company data.',
            'Avoid deleting a company that already has dependent records unless the system allows it safely.'
          ]
        }
      ]
    },
    departments: {
      title: 'Departments Manual',
      subtitle: 'Create and manage department records.',
      icon: 'account_tree',
      sections: [
        {
          heading: 'Department Setup',
          items: [
            'Create departments under the correct company.',
            'Use meaningful department names so employee filtering and reporting remain clear.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Edit a department when naming or configuration changes are needed.',
            'Check linked employees before deleting a department.'
          ]
        }
      ]
    },
    designations: {
      title: 'Designations Manual',
      subtitle: 'Manage employee designation records.',
      icon: 'workspace_premium',
      sections: [
        {
          heading: 'Designation Setup',
          items: [
            'Create designations that match job roles used by HR and payroll.',
            'Assign designations during employee creation or update.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Edit designation names when organization role titles change.',
            'Review employees linked to a designation before deletion.'
          ]
        }
      ]
    },
    'salary-rules': {
      title: 'Salary Rules Manual',
      subtitle: 'Configure payroll salary rule definitions.',
      icon: 'payments',
      sections: [
        {
          heading: 'Rule Setup',
          items: [
            'Create salary rules that match company payroll policies.',
            'Assign the correct salary rule to employees in Employee Info.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Update rules only after confirming payroll impact.',
            'Avoid deleting rules that are already assigned to active employees.'
          ]
        }
      ]
    },
    shifts: {
      title: 'Shift Info Manual',
      subtitle: 'Create and maintain working shift definitions.',
      icon: 'schedule',
      sections: [
        {
          heading: 'Shift Setup',
          items: [
            'Define shift timing based on actual working schedules.',
            'Use active shift records when assigning employees.'
          ]
        },
        {
          heading: 'Attendance Impact',
          items: [
            'Shift timing affects attendance interpretation and payroll calculations.',
            'Review shift changes before applying them to many employees.'
          ]
        }
      ]
    },
    authorizers: {
      title: 'Authorizers Manual',
      subtitle: 'Manage people who authorize HR or payroll actions.',
      icon: 'verified_user',
      sections: [
        {
          heading: 'Authorizer Setup',
          items: [
            'Create authorizers with accurate personal and employment details.',
            'Upload photo and signature where required for official documents.'
          ]
        },
        {
          heading: 'Access Usage',
          items: [
            'Keep authorizer status accurate so inactive people are not used for approvals.',
            'Review department and designation links before saving.'
          ]
        }
      ]
    }
  };

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
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly documentRef: Document
  ) {
    this.currentManual = this.defaultManual;
  }

  ngOnInit(): void {
    this.loadFontPreferences();
    this.syncManual(this.router.url);
    this.loadAnnouncements();
    this.announcementSubscription = this.announcementService.changed$.subscribe(() => {
      this.loadAnnouncements();
    });
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncManual(event.urlAfterRedirects);
        this.isInfoMenuOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.announcementSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isAnnouncementMenuOpen && !this.isAccessibilityMenuOpen && !this.isInfoMenuOpen) {
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
      this.isInfoMenuOpen = false;
      this.accessibilityView = 'main';
    }
  }

  toggleInfoMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isInfoMenuOpen = !this.isInfoMenuOpen;
    if (this.isInfoMenuOpen) {
      this.closeAnnouncementMenu();
      this.isAccessibilityMenuOpen = false;
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
    this.isInfoMenuOpen = false;
    this.accessibilityView = 'main';
  }

  private syncManual(url: string): void {
    const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '') || 'dashboard';
    this.currentManual = this.manualByPath[path] ?? this.defaultManual;
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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { CompanyService } from '../../services/company.service';
import { Company } from '../../models/company.model';
import { Inject } from '@angular/core';
import { CommonHeaderComponent } from '../../shared/common-header/common-header.component';

@Component({
  selector: 'app-landing-layout',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, CommonHeaderComponent],
  templateUrl: './landing-layout.component.html',
  styleUrl: './landing-layout.component.scss'
})
export class LandingLayoutComponent implements OnInit, OnDestroy {
  private readonly fallbackBrandName = 'Visor';
  private readonly fallbackBrandLogoSrc = 'visor.png';

  companyBrandName = this.fallbackBrandName;
  companyLogoSrc: string | null = this.fallbackBrandLogoSrc;
  isSettingsOpen = true;
  private routerSubscription?: Subscription;

  constructor(
    private readonly companyService: CompanyService,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly documentRef: Document
  ) {}

  ngOnInit(): void {
    this.loadBranding();
    this.syncMenuStateWithRoute(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.loadBranding();
        this.syncMenuStateWithRoute(event.urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private loadBranding(): void {
    this.companyService.getAll().subscribe({
      next: (companies) => {
        const company = this.selectPrimaryCompany(companies);
        if (!company) {
          this.applyFallbackBranding();
          return;
        }

        this.companyBrandName = company.name?.trim() || this.fallbackBrandName;
        this.companyLogoSrc = this.resolveCompanyLogo(company) ?? this.fallbackBrandLogoSrc;
        this.setBrowserBranding(this.companyBrandName, this.companyLogoSrc);
      },
      error: () => {
        this.applyFallbackBranding();
      }
    });
  }

  private selectPrimaryCompany(companies: Company[]): Company | null {
    if (!companies.length) {
      return null;
    }

    const activeCompany = companies.find((company) => {
      const status = Object.entries(company.dynamicAttributes).find(
        ([key]) => key.trim().toLowerCase() === 'status'
      )?.[1];
      return (status ?? '').trim().toLowerCase() === 'active';
    });

    return activeCompany ?? companies[0];
  }

  private resolveCompanyLogo(company: Company): string | null {
    if (company.logoBase64) {
      return company.logoBase64;
    }

    const logoUrl = company.logoUrl?.trim();
    if (!logoUrl) {
      return null;
    }

    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:')) {
      return logoUrl;
    }

    return `http://localhost:5277/${logoUrl.replace(/^\/+/, '')}`;
  }

  private applyFallbackBranding(): void {
    this.companyBrandName = this.fallbackBrandName;
    this.companyLogoSrc = this.fallbackBrandLogoSrc;
    this.setBrowserBranding(this.companyBrandName, this.companyLogoSrc);
  }

  onBrandLogoError(): void {
    this.companyLogoSrc = this.fallbackBrandLogoSrc;
    this.setBrowserBranding(this.companyBrandName, this.companyLogoSrc);
  }

  private setBrowserBranding(companyName: string, logoSrc: string): void {
    this.documentRef.title = companyName;

    const existingIcon = this.documentRef.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const iconElement = existingIcon ?? this.documentRef.createElement('link');
    iconElement.rel = 'icon';
    iconElement.type = logoSrc.toLowerCase().endsWith('.png') ? 'image/png' : 'image/x-icon';
    iconElement.href = logoSrc;

    if (!existingIcon) {
      this.documentRef.head.appendChild(iconElement);
    }
  }

  toggleSettingsMenu(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  private syncMenuStateWithRoute(url: string): void {
    if (this.isSettingsRoute(url)) {
      this.isSettingsOpen = true;
    }
  }

  private isSettingsRoute(url: string): boolean {
    return (
      url.startsWith('/company-info') ||
      url.startsWith('/departments') ||
      url.startsWith('/designations') ||
      url.startsWith('/report-templates') ||
      url.startsWith('/shifts')
    );
  }
}

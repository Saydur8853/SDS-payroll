import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { CompanyService } from '../../services/company.service';
import { Company } from '../../models/company.model';
import { Inject } from '@angular/core';

@Component({
  selector: 'app-landing-layout',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './landing-layout.component.html',
  styleUrl: './landing-layout.component.scss'
})
export class LandingLayoutComponent implements OnInit, OnDestroy {
  companyBrandName = 'SDS Payroll';
  companyLogoSrc: string | null = null;
  private routerSubscription?: Subscription;

  constructor(
    private readonly companyService: CompanyService,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly documentRef: Document
  ) {}

  ngOnInit(): void {
    this.loadBranding();
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.loadBranding());
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private loadBranding(): void {
    this.companyService.getAll().subscribe({
      next: (companies) => {
        const company = this.selectPrimaryCompany(companies);
        if (!company) {
          this.companyBrandName = 'SDS Payroll';
          this.companyLogoSrc = null;
          this.setBrowserBranding(this.companyBrandName, null);
          return;
        }

        this.companyBrandName = company.name?.trim() || 'SDS Payroll';
        this.companyLogoSrc = this.resolveCompanyLogo(company);
        this.setBrowserBranding(this.companyBrandName, this.companyLogoSrc);
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

  private setBrowserBranding(companyName: string, logoSrc: string | null): void {
    this.documentRef.title = companyName;

    const existingIcon = this.documentRef.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const iconElement = existingIcon ?? this.documentRef.createElement('link');
    iconElement.rel = 'icon';
    iconElement.type = 'image/x-icon';
    iconElement.href = logoSrc ?? 'favicon.ico';

    if (!existingIcon) {
      this.documentRef.head.appendChild(iconElement);
    }
  }
}

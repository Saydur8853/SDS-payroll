import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyService } from '../../services/company.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  companyCount = 0;
  loading = true;

  constructor(private readonly companyService: CompanyService) {}

  ngOnInit(): void {
    this.companyService.getAll().subscribe({
      next: (companies) => {
        this.companyCount = companies.length;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}

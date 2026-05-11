import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CompanyService } from '../../services/company.service';
import { EmployeeService } from '../../services/employee.service';
import { LookupService } from '../../services/lookup.service';
import { ShiftService } from '../../services/shift.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  companyCount = 0;
  employeeCount = 0;
  departmentCount = 0;
  designationCount = 0;
  shiftCount = 0;
  loading = true;
  today = new Date();

  constructor(
    private readonly companyService: CompanyService,
    private readonly employeeService: EmployeeService,
    private readonly lookupService: LookupService,
    private readonly shiftService: ShiftService
  ) {}

  ngOnInit(): void {
    forkJoin({
      companies: this.companyService.getAll(),
      employees: this.employeeService.getAll({ page: 1, pageSize: 1 }),
      departments: this.lookupService.getDepartments(),
      designations: this.lookupService.getDesignations(),
      shifts: this.shiftService.getAll()
    }).subscribe({
      next: (data) => {
        this.companyCount = data.companies.length;
        this.employeeCount = data.employees.totalCount ?? data.employees.items?.length ?? 0;
        this.departmentCount = data.departments.length;
        this.designationCount = data.designations.length;
        this.shiftCount = data.shifts.length;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}

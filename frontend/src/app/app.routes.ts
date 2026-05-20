import { Routes } from '@angular/router';
import { CompanyInfoComponent } from './pages/company-info/company-info.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LandingLayoutComponent } from './pages/landing-layout/landing-layout.component';
import { EmployeeInfoComponent } from './pages/employee-info/employee-info.component';
import { DepartmentsComponent } from './pages/departments/departments.component';
import { DesignationsComponent } from './pages/designations/designations.component';
import { ShiftsComponent } from './pages/shifts/shifts.component';
import { AuthorizersComponent } from './pages/authorizers/authorizers.component';
import { AttendanceComponent } from './pages/attendance/attendance.component';
import { SalaryRulesComponent } from './pages/salary-rules/salary-rules.component';
import { AttendanceRawDataComponent } from './pages/attendance-raw-data/attendance-raw-data.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'company-info', component: CompanyInfoComponent },
      { path: 'employee-info', component: EmployeeInfoComponent },
      { path: 'attendance', component: AttendanceComponent },
      { path: 'attendance-raw-data', component: AttendanceRawDataComponent },
      { path: 'authorizers', component: AuthorizersComponent },
      { path: 'departments', component: DepartmentsComponent },
      { path: 'designations', component: DesignationsComponent },
      { path: 'salary-rules', component: SalaryRulesComponent },
      { path: 'shifts', component: ShiftsComponent }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];

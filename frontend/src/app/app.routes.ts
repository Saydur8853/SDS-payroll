import { Routes } from '@angular/router';
import { CompanyInfoComponent } from './pages/company-info/company-info.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LandingLayoutComponent } from './pages/landing-layout/landing-layout.component';
import { EmployeeInfoComponent } from './pages/employee-info/employee-info.component';
import { DepartmentsComponent } from './pages/departments/departments.component';
import { DesignationsComponent } from './pages/designations/designations.component';
import { ShiftsComponent } from './pages/shifts/shifts.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'company-info', component: CompanyInfoComponent },
      { path: 'employee-info', component: EmployeeInfoComponent },
      { path: 'departments', component: DepartmentsComponent },
      { path: 'designations', component: DesignationsComponent },
      { path: 'shifts', component: ShiftsComponent }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];

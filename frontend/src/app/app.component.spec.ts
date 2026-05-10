import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { CompanyService } from './services/company.service';

describe('AppComponent', () => {
  const companyServiceMock = {
    getAll: jasmine.createSpy('getAll').and.returnValue(of([])),
    create: jasmine.createSpy('create'),
    createWithLogoUpload: jasmine.createSpy('createWithLogoUpload')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: CompanyService, useValue: companyServiceMock }]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render main title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Payroll Company Setup');
  });
});

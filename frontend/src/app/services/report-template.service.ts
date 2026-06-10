import { Injectable } from '@angular/core';

export type ReportOrientation = 'landscape' | 'portrait';
export type ReportPageSize = 'A4';
export type VisualReportBlockType = 'field' | 'text' | 'image' | 'table';
export type VisualReportImageKind = 'photo' | 'signature';
export type VisualReportTextAlign = 'left' | 'center' | 'right';

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ReportFieldDefinition {
  key: string;
  label: string;
  sample: string;
}

export interface ReportTemplateField {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
  isCustom?: boolean;
}

export interface ReportTemplate {
  id: string;
  reportType: 'employee-info';
  title: string;
  subtitle: string;
  pageSize: ReportPageSize;
  orientation: ReportOrientation;
  /** Page margins in millimetres */
  pageMargins: PageMargins;
  fields: ReportTemplateField[];
  visualBlocks: VisualReportBlock[];
  htmlContent?: string;
  updatedAtUtc: string;
}

export interface VisualReportBlock {
  id: string;
  type: VisualReportBlockType;
  fieldKey?: string;
  label: string;
  text?: string;
  imageKind?: VisualReportImageKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  align: VisualReportTextAlign;
  border: boolean;
  textColor?: string;
  tableRows?: number;
  tableColumns?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportTemplateService {
  private readonly employeeTemplateStorageKey = 'sds-payroll-report-template-employee-info';

  readonly employeeFieldDefinitions: ReportFieldDefinition[] = [
    { key: 'id', label: 'Employee ID', sample: 'EMP-UUID' },
    { key: 'employeeCode', label: 'Employee Code', sample: '101' },
    { key: 'fullName', label: 'Full Name', sample: 'John Smith' },
    { key: 'phone', label: 'Phone', sample: '017XXXXXXXX' },
    { key: 'email', label: 'Email', sample: 'john@company.com' },
    { key: 'companyId', label: 'Company ID', sample: 'COMP-UUID' },
    { key: 'company', label: 'Company', sample: 'Talha Group' },
    { key: 'departmentId', label: 'Department ID', sample: 'DEPT-UUID' },
    { key: 'department', label: 'Department', sample: 'HR' },
    { key: 'designationId', label: 'Designation ID', sample: 'DESIG-UUID' },
    { key: 'designation', label: 'Designation', sample: 'Officer' },
    { key: 'employmentStatus', label: 'Status', sample: 'Active' },
    { key: 'joiningDate', label: 'Joining Date', sample: '01 Jan 2026' },
    { key: 'gender', label: 'Gender', sample: 'Male' },
    { key: 'religion', label: 'Religion', sample: 'Islam' },
    { key: 'maritalStatus', label: 'Marital Status', sample: 'Married' },
    { key: 'bloodGroup', label: 'Blood Group', sample: 'O+' },
    { key: 'nationalId', label: 'National ID', sample: '1234567890' },
    { key: 'dateOfBirth', label: 'Date of Birth', sample: '01 Jan 1990' },
    { key: 'address', label: 'Address', sample: 'Dhaka' },
    { key: 'fatherName', label: "Father's Name", sample: 'Father Name' },
    { key: 'fatherPhone', label: "Father's Phone", sample: '017XXXXXXXX' },
    { key: 'motherName', label: "Mother's Name", sample: 'Mother Name' },
    { key: 'motherPhone', label: "Mother's Phone", sample: '017XXXXXXXX' },
    { key: 'spouseName', label: 'Spouse Name', sample: 'Spouse Name' },
    { key: 'spousePhone', label: 'Spouse Phone', sample: '017XXXXXXXX' },
    { key: 'shiftId', label: 'Shift ID', sample: 'SHIFT-UUID' },
    { key: 'workingTime', label: 'Working Time', sample: 'General' },
    { key: 'salaryRule', label: 'Salary Rule', sample: 'Monthly' },
    { key: 'grossSalary', label: 'Gross Salary', sample: '25000' },
    { key: 'basicSalary', label: 'Basic Salary', sample: '15000' },
    { key: 'weekend', label: 'Weekend', sample: 'Friday' },
    { key: 'salaryAccount', label: 'Salary Account', sample: '123456789' },
    { key: 'createdAtUtc', label: 'Created At', sample: '01 Jan 2026' },
    { key: 'updatedAtUtc', label: 'Updated At', sample: '02 Jan 2026' }
  ];

  getEmployeeTemplate(): ReportTemplate {
    const savedTemplate = this.readSavedEmployeeTemplate();
    const template = savedTemplate ?? this.createDefaultEmployeeTemplate();
    return this.normalizeEmployeeTemplate(template);
  }

  saveEmployeeTemplate(template: ReportTemplate): ReportTemplate {
    const normalizedTemplate = this.normalizeEmployeeTemplate({
      ...template,
      updatedAtUtc: new Date().toISOString()
    });

    localStorage.setItem(this.employeeTemplateStorageKey, JSON.stringify(normalizedTemplate));
    return normalizedTemplate;
  }

  resetEmployeeTemplate(): ReportTemplate {
    const template = this.createDefaultEmployeeTemplate();
    localStorage.setItem(this.employeeTemplateStorageKey, JSON.stringify(template));
    return template;
  }

  private readSavedEmployeeTemplate(): ReportTemplate | null {
    const rawTemplate = localStorage.getItem(this.employeeTemplateStorageKey);
    if (!rawTemplate) {
      return null;
    }

    try {
      return JSON.parse(rawTemplate) as ReportTemplate;
    } catch {
      return null;
    }
  }

  private createDefaultEmployeeTemplate(): ReportTemplate {
    const defaultEnabledFields = new Set([
      'employeeCode',
      'fullName',
      'phone',
      'company',
      'department',
      'designation',
      'employmentStatus',
      'joiningDate'
    ]);

    return {
      id: 'employee-info-default',
      reportType: 'employee-info',
      title: 'Employee List',
      subtitle: 'Employee information report',
      pageSize: 'A4',
      orientation: 'landscape',
      pageMargins: { top: 20, bottom: 20, left: 20, right: 20 },
      fields: this.employeeFieldDefinitions.map((field, index) => ({
        key: field.key,
        label: field.label,
        enabled: defaultEnabledFields.has(field.key),
        order: index
      })),
      visualBlocks: [],
      htmlContent: `
        <div style="font-family: Arial; color: #0f172a;">
          <h1 style="font-size: 22px; margin-bottom: 20px;">Employee Information</h1>
          <p style="font-size: 14px; margin-bottom: 10px; font-weight: bold;">
            <span contenteditable="false" class="attribute-pill" data-key="fullName" data-type="field">[Full Name]</span>
          </p>
          <p style="font-size: 11px;">
            <span contenteditable="false" class="attribute-pill" data-key="employeeCode" data-type="field">[Employee Code]</span>
          </p>
          <div style="text-align: right; margin-top: -60px;">
            <div contenteditable="false" class="attribute-pill image-pill" data-kind="photo" data-type="image" style="display: inline-block; width: 105px; height: 130px; border: 1px dashed #cbd5e1; background: #f8fafc; text-align: center; line-height: 130px; font-size: 12px; color: #64748b;">[Photo]</div>
          </div>
        </div>
      `,
      updatedAtUtc: new Date().toISOString()
    };
  }

  private normalizeEmployeeTemplate(template: ReportTemplate): ReportTemplate {
    const savedFieldsByKey = new Map((template.fields ?? []).map((field) => [field.key, field]));
    const knownFieldKeys = new Set(this.employeeFieldDefinitions.map((field) => field.key));
    const customFields = (template.fields ?? [])
      .filter((field) => !knownFieldKeys.has(field.key))
      .map((field) => ({
        key: field.key,
        label: field.label?.trim() || field.key.replace(/^dynamic:/, ''),
        enabled: field.enabled,
        order: field.order,
        isCustom: true
      }));

    const fields = [
      ...this.employeeFieldDefinitions
      .map((definition, index) => {
        const savedField = savedFieldsByKey.get(definition.key);
        return {
          key: definition.key,
          label: savedField?.label?.trim() || definition.label,
          enabled: savedField?.enabled ?? false,
          order: savedField?.order ?? index
        };
      }),
      ...customFields
    ]
      .sort((first, second) => first.order - second.order)
      .map((field, index) => ({ ...field, order: index }));

    const margins = template.pageMargins ?? { top: 20, bottom: 20, left: 20, right: 20 };
    return {
      id: template.id || 'employee-info-default',
      reportType: 'employee-info',
      title: template.title?.trim() || 'Employee List',
      subtitle: template.subtitle?.trim() || 'Employee information report',
      pageSize: 'A4',
      orientation: template.orientation === 'portrait' ? 'portrait' : 'landscape',
      pageMargins: {
        top:    Number.isFinite(margins.top)    ? margins.top    : 20,
        bottom: Number.isFinite(margins.bottom) ? margins.bottom : 20,
        left:   Number.isFinite(margins.left)   ? margins.left   : 20,
        right:  Number.isFinite(margins.right)  ? margins.right  : 20
      },
      fields,
      visualBlocks: this.normalizeVisualBlocks(template.visualBlocks ?? []),
      htmlContent: template.htmlContent || '',
      updatedAtUtc: template.updatedAtUtc || new Date().toISOString()
    };
  }

  private normalizeVisualBlocks(blocks: VisualReportBlock[]): VisualReportBlock[] {
    return blocks
      .filter((block) => block && block.id && block.type)
      .map((block) => ({
        id: block.id,
        type: block.type === 'image' || block.type === 'text' || block.type === 'table' ? block.type : 'field',
        fieldKey: block.fieldKey,
        label: block.label?.trim() || block.fieldKey || block.text || 'Block',
        text: block.text ?? '',
        imageKind: block.imageKind === 'signature' ? 'signature' : 'photo',
        x: Number.isFinite(block.x) ? block.x : 40,
        y: Number.isFinite(block.y) ? block.y : 40,
        width: Number.isFinite(block.width) && block.width > 0 ? block.width : 160,
        height: Number.isFinite(block.height) && block.height > 0 ? block.height : 32,
        fontSize: Number.isFinite(block.fontSize) && block.fontSize > 0 ? block.fontSize : 11,
        fontFamily: block.fontFamily?.trim() || 'Arial',
        bold: !!block.bold,
        italic: !!block.italic,
        underline: !!block.underline,
        align: block.align === 'center' || block.align === 'right' ? block.align : 'left',
        border: !!block.border,
        textColor: block.textColor?.trim() || '#0f172a',
        tableRows: Number.isFinite(block.tableRows) && Number(block.tableRows) > 0 ? Math.round(Number(block.tableRows)) : 3,
        tableColumns: Number.isFinite(block.tableColumns) && Number(block.tableColumns) > 0 ? Math.round(Number(block.tableColumns)) : 3
      }));
  }
}

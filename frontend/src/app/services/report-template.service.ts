import { Injectable } from '@angular/core';

export type ReportOrientation = 'landscape' | 'portrait';
export type ReportPageSize = 'A4';
export type VisualReportBlockType = 'field' | 'text' | 'image';
export type VisualReportImageKind = 'photo' | 'signature';
export type VisualReportTextAlign = 'left' | 'center' | 'right';

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
  fields: ReportTemplateField[];
  visualBlocks: VisualReportBlock[];
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
  bold: boolean;
  align: VisualReportTextAlign;
  border: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReportTemplateService {
  private readonly employeeTemplateStorageKey = 'sds-payroll-report-template-employee-info';

  readonly employeeFieldDefinitions: ReportFieldDefinition[] = [
    { key: 'employeeCode', label: 'Employee Code', sample: '101' },
    { key: 'fullName', label: 'Full Name', sample: 'John Smith' },
    { key: 'phone', label: 'Phone', sample: '017XXXXXXXX' },
    { key: 'email', label: 'Email', sample: 'john@company.com' },
    { key: 'company', label: 'Company', sample: 'Talha Group' },
    { key: 'department', label: 'Department', sample: 'HR' },
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
    { key: 'workingTime', label: 'Working Time', sample: 'General' },
    { key: 'salaryRule', label: 'Salary Rule', sample: 'Monthly' },
    { key: 'grossSalary', label: 'Gross Salary', sample: '25000' },
    { key: 'basicSalary', label: 'Basic Salary', sample: '15000' },
    { key: 'weekend', label: 'Weekend', sample: 'Friday' },
    { key: 'salaryAccount', label: 'Salary Account', sample: '123456789' }
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
      fields: this.employeeFieldDefinitions.map((field, index) => ({
        key: field.key,
        label: field.label,
        enabled: defaultEnabledFields.has(field.key),
        order: index
      })),
      visualBlocks: [
        {
          id: 'title',
          type: 'text',
          label: 'Report Title',
          text: 'Employee Information',
          x: 40,
          y: 32,
          width: 420,
          height: 42,
          fontSize: 22,
          bold: true,
          align: 'left',
          border: false
        },
        {
          id: 'employee-name',
          type: 'field',
          fieldKey: 'fullName',
          label: 'Full Name',
          x: 40,
          y: 105,
          width: 310,
          height: 34,
          fontSize: 14,
          bold: true,
          align: 'left',
          border: false
        },
        {
          id: 'employee-code',
          type: 'field',
          fieldKey: 'employeeCode',
          label: 'Employee Code',
          x: 40,
          y: 150,
          width: 190,
          height: 28,
          fontSize: 11,
          bold: false,
          align: 'left',
          border: false
        },
        {
          id: 'employee-photo',
          type: 'image',
          imageKind: 'photo',
          label: 'Photo',
          x: 610,
          y: 52,
          width: 105,
          height: 130,
          fontSize: 10,
          bold: false,
          align: 'center',
          border: true
        }
      ],
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

    return {
      id: template.id || 'employee-info-default',
      reportType: 'employee-info',
      title: template.title?.trim() || 'Employee List',
      subtitle: template.subtitle?.trim() || 'Employee information report',
      pageSize: 'A4',
      orientation: template.orientation === 'portrait' ? 'portrait' : 'landscape',
      fields,
      visualBlocks: this.normalizeVisualBlocks(template.visualBlocks ?? []),
      updatedAtUtc: template.updatedAtUtc || new Date().toISOString()
    };
  }

  private normalizeVisualBlocks(blocks: VisualReportBlock[]): VisualReportBlock[] {
    return blocks
      .filter((block) => block && block.id && block.type)
      .map((block) => ({
        id: block.id,
        type: block.type === 'image' || block.type === 'text' ? block.type : 'field',
        fieldKey: block.fieldKey,
        label: block.label?.trim() || block.fieldKey || block.text || 'Block',
        text: block.text ?? '',
        imageKind: block.imageKind === 'signature' ? 'signature' : 'photo',
        x: Number.isFinite(block.x) ? block.x : 40,
        y: Number.isFinite(block.y) ? block.y : 40,
        width: Number.isFinite(block.width) && block.width > 0 ? block.width : 160,
        height: Number.isFinite(block.height) && block.height > 0 ? block.height : 32,
        fontSize: Number.isFinite(block.fontSize) && block.fontSize > 0 ? block.fontSize : 11,
        bold: !!block.bold,
        align: block.align === 'center' || block.align === 'right' ? block.align : 'left',
        border: !!block.border
      }));
  }
}

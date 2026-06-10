import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PageMargins,
  ReportFieldDefinition,
  ReportTemplate,
  ReportTemplateService,
  VisualReportBlock,
  VisualReportBlockType,
  VisualReportImageKind
} from '../../services/report-template.service';


@Component({
  selector: 'app-report-templates',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-templates.component.html',
  styleUrl: './report-templates.component.scss'
})
export class ReportTemplatesComponent implements OnInit, AfterViewInit {
  @ViewChild('editorCanvas') editorCanvas!: ElementRef<HTMLDivElement>;

  employeeTemplate!: ReportTemplate;
  message = '';
  activeInsertTab: 'attributes' | 'tools' = 'attributes';
  selectedTextStyle = 'Normal text';
  /** Alias used in the template for the current text style select. */
  get currentTextStyle(): string { return this.selectedTextStyle; }
  selectedFontFamily = 'Arial';

  /** Page dimensions (mm) used for aspect-ratio styling on the canvas. */
  get pageWidth(): number {
    return this.employeeTemplate?.orientation === 'portrait' ? 210 : 297;
  }
  get pageHeight(): number {
    return this.employeeTemplate?.orientation === 'portrait' ? 297 : 210;
  }

  /**
   * Converts the stored mm margins to a CSS padding string for the canvas.
   * 1 mm ≈ 3.7795 px at 96 dpi.
   */
  get canvasPaddingStyle(): string {
    const m = this.employeeTemplate?.pageMargins;
    if (!m) { return '40px'; }
    const toPx = (mm: number) => Math.round(mm * 3.7795) + 'px';
    return `${toPx(m.top)} ${toPx(m.right)} ${toPx(m.bottom)} ${toPx(m.left)}`;
  }

  /** Individual margin px values for CSS custom property bindings (margin guide). */
  get marginPx(): { top: string; right: string; bottom: string; left: string } {
    const m = this.employeeTemplate?.pageMargins;
    const toPx = (mm: number) => Math.round(mm * 3.7795) + 'px';
    if (!m) { return { top: '40px', right: '40px', bottom: '40px', left: '40px' }; }
    return {
      top:    toPx(m.top),
      right:  toPx(m.right),
      bottom: toPx(m.bottom),
      left:   toPx(m.left)
    };
  }

  /**
   * selectedBlock is kept as null in this contenteditable-canvas approach.
   * It is declared so the template bindings compile without errors.
   * The properties panel's "no block selected" placeholder will always show.
   */
  selectedBlock: VisualReportBlock | null = null;
  private draggedPaletteItem: { type: VisualReportBlockType; key?: string; label: string; imageKind?: VisualReportImageKind } | null = null;

  readonly fieldDefinitions: ReportFieldDefinition[];
  readonly textStyleOptions = ['Normal text', 'Title', 'Heading', 'Subtitle'];
  readonly fontFamilyOptions = [
    'Arial',
    'Calibri',
    'Roboto',
    'Times New Roman',
    'SutonnyMJ',
    'Nikosh Bangla',
    'Tiro Bangla',
    'Hind Siliguri',
    'Anek Bangla'
  ];

  constructor(private readonly reportTemplateService: ReportTemplateService) {
    this.fieldDefinitions = this.reportTemplateService.employeeFieldDefinitions;
  }

  ngOnInit(): void {
    this.employeeTemplate = this.reportTemplateService.getEmployeeTemplate();
  }

  ngAfterViewInit(): void {
    if (this.editorCanvas && this.employeeTemplate.htmlContent) {
      this.editorCanvas.nativeElement.innerHTML = this.employeeTemplate.htmlContent;
    }
  }

  onCanvasInput(): void {
    if (this.editorCanvas) {
      this.employeeTemplate.htmlContent = this.editorCanvas.nativeElement.innerHTML;
    }
  }

  saveTemplate(): void {
    this.employeeTemplate = this.reportTemplateService.saveEmployeeTemplate(this.employeeTemplate);
    this.message = 'Employee Info report template saved.';
  }

  onPaletteDragStart(event: DragEvent, item: { type: VisualReportBlockType; key?: string; label: string; imageKind?: VisualReportImageKind }): void {
    this.draggedPaletteItem = item;
    event.dataTransfer?.setData('text/plain', item.label);
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    if (!this.draggedPaletteItem) {
      return;
    }

    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(event.clientX, event.clientY);
    }

    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    this.editorCanvas?.nativeElement.focus();

    if (this.draggedPaletteItem.type === 'text') {
      document.execCommand('insertText', false, 'Custom Text');
    } else if (this.draggedPaletteItem.type === 'table') {
      const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px;" border="1">
          <tbody>
            <tr><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td></tr>
            <tr><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td></tr>
            <tr><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td><td style="padding: 4px;">&nbsp;</td></tr>
          </tbody>
        </table><p>&nbsp;</p>
      `;
      document.execCommand('insertHTML', false, tableHtml);
    } else if (this.draggedPaletteItem.type === 'image') {
      const label = this.draggedPaletteItem.imageKind === 'signature' ? 'Signature' : 'Photo';
      const width = this.draggedPaletteItem.imageKind === 'signature' ? '160px' : '105px';
      const height = this.draggedPaletteItem.imageKind === 'signature' ? '55px' : '130px';
      const imageHtml = `<div contenteditable="false" class="attribute-pill image-pill" data-kind="${this.draggedPaletteItem.imageKind}" data-type="image" style="display: inline-block; width: ${width}; height: ${height}; border: 1px dashed #cbd5e1; background: #f8fafc; text-align: center; line-height: ${height}; font-size: 12px; color: #64748b;">[${label}]</div>&nbsp;`;
      document.execCommand('insertHTML', false, imageHtml);
    } else {
      const fieldHtml = `<span contenteditable="false" class="attribute-pill" data-key="${this.draggedPaletteItem.key}" data-type="field" style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; display: inline-block; margin: 0 2px;">[${this.draggedPaletteItem.label}]</span>&nbsp;`;
      document.execCommand('insertHTML', false, fieldHtml);
    }

    this.onCanvasInput();
    this.draggedPaletteItem = null;
  }

  applyTextStyle(style: string): void {
    this.selectedTextStyle = style;
    let size = 3;
    if (style === 'Title') {
      size = 6;
      document.execCommand('bold', false, 'true');
    } else if (style === 'Heading') {
      size = 5;
      document.execCommand('bold', false, 'true');
    } else if (style === 'Subtitle') {
      size = 4;
    } else {
      size = 3;
    }
    document.execCommand('fontSize', false, size.toString());
    this.onCanvasInput();
  }

  applyFontFamily(fontFamily: string): void {
    this.selectedFontFamily = fontFamily;
    document.execCommand('fontName', false, fontFamily);
    this.onCanvasInput();
  }

  toggleSelectedFormat(format: 'bold' | 'italic' | 'underline' | 'border'): void {
    if (format === 'border') {
      return; 
    }
    document.execCommand(format, false, '');
    this.onCanvasInput();
  }

  changeSelectedFontSize(delta: number): void {
    // In the contenteditable canvas, font-size changes operate on the selection.
    // We read the current computed size from the selection and adjust it.
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) { return; }
    const range = selection.getRangeAt(0);
    const el = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const currentSize = el ? parseInt(window.getComputedStyle(el).fontSize, 10) : 11;
    const newSize = Math.min(72, Math.max(6, (isNaN(currentSize) ? 11 : currentSize) + delta));
    document.execCommand('fontSize', false, '7'); // placeholder size
    // Replace font-size on the newly created <font> elements
    const fonts = this.editorCanvas?.nativeElement.querySelectorAll('font[size="7"]');
    fonts?.forEach((f: Element) => {
      (f as HTMLElement).removeAttribute('size');
      (f as HTMLElement).style.fontSize = newSize + 'px';
    });
    this.onCanvasInput();
  }

  setSelectedFontSize(size: number): void {
    if (!size || size < 6 || size > 72) { return; }
    document.execCommand('fontSize', false, '7');
    const fonts = this.editorCanvas?.nativeElement.querySelectorAll('font[size="7"]');
    fonts?.forEach((f: Element) => {
      (f as HTMLElement).removeAttribute('size');
      (f as HTMLElement).style.fontSize = size + 'px';
    });
    this.onCanvasInput();
  }

  deleteSelectedBlock(): void {
    // No-op in canvas mode; selectedBlock is always null.
  }

  isOrientationDropdownOpen = false;
  isMarginDropdownOpen = false;

  toggleMarginDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isMarginDropdownOpen = !this.isMarginDropdownOpen;
    this.isOrientationDropdownOpen = false;
  }

  toggleOrientationDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isOrientationDropdownOpen = !this.isOrientationDropdownOpen;
    this.isMarginDropdownOpen = false;
  }

  selectOrientation(orientation: 'portrait' | 'landscape'): void {
    this.setOrientation(orientation);
    this.isOrientationDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.isOrientationDropdownOpen = false;
    this.isMarginDropdownOpen = false;
  }

  setOrientation(orientation: 'portrait' | 'landscape'): void {
    if (!this.employeeTemplate) { return; }
    this.employeeTemplate = { ...this.employeeTemplate, orientation };
  }

  updateMargin(side: keyof PageMargins, value: number): void {
    if (!this.employeeTemplate) { return; }
    const clamped = Math.max(0, Math.min(100, isNaN(value) ? 20 : value));
    this.employeeTemplate = {
      ...this.employeeTemplate,
      pageMargins: { ...this.employeeTemplate.pageMargins, [side]: clamped }
    };
  }

  setSelectedColor(color: string): void {
    document.execCommand('foreColor', false, color);
    this.onCanvasInput();
  }

  setSelectedAlign(align: 'left' | 'center' | 'right'): void {
    if (align === 'left') document.execCommand('justifyLeft', false, '');
    else if (align === 'center') document.execCommand('justifyCenter', false, '');
    else if (align === 'right') document.execCommand('justifyRight', false, '');
    this.onCanvasInput();
  }
}

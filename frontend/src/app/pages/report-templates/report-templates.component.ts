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

  get currentFontSize(): number {
    return this.selectedFontSize;
  }

  get currentPageBreakLabel(): string {
    const key = this.employeeTemplate?.pageBreakFieldKey;
    if (!key) { return 'No page break'; }
    return this.employeeTemplate.fields.find((field) => field.key === key)?.label ?? key;
  }

  /**
   * selectedBlock is kept as null in this contenteditable-canvas approach.
   * It is declared so the template bindings compile without errors.
   * The properties panel's "no block selected" placeholder will always show.
   */
  selectedBlock: VisualReportBlock | null = null;
  private draggedPaletteItem: { type: VisualReportBlockType; key?: string; label: string; imageKind?: VisualReportImageKind } | null = null;
  private savedCanvasRange: Range | null = null;
  selectedFontSize = 11;

  readonly fieldDefinitions: ReportFieldDefinition[];
  readonly textStyleOptions = ['Normal text', 'Title', 'Heading', 'Subtitle'];
  readonly tablePickerRows = Array.from({ length: 8 }, (_, index) => index + 1);
  readonly tablePickerColumns = Array.from({ length: 8 }, (_, index) => index + 1);
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
      this.rememberCanvasSelection();
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
      this.insertTableHtml();
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

  insertPickedTable(rows: number, columns: number): void {
    this.insertTableHtml(rows, columns);
    this.isTablePickerOpen = false;
    this.onCanvasInput();
  }

  private insertTableHtml(rows = 3, columns = 3): void {
    if (!this.editorCanvas) { return; }

    if (!this.restoreCanvasSelection()) {
      this.editorCanvas.nativeElement.focus();
    }

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rowCount = Math.max(1, Math.min(8, rows));
    const columnCount = Math.max(1, Math.min(8, columns));

    const table = document.createElement('table');
    table.setAttribute('border', '1');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '10px';
    table.style.marginBottom = '10px';

    const tbody = document.createElement('tbody');
    let firstCell: HTMLTableCellElement | null = null;

    Array.from({ length: rowCount }).forEach(() => {
      const tr = document.createElement('tr');
      Array.from({ length: columnCount }).forEach(() => {
        const td = document.createElement('td');
        td.style.padding = '6px 8px';
        td.style.minWidth = '48px';
        td.style.height = '28px';
        td.innerHTML = '<br>';
        firstCell ??= td;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    const trailingParagraph = document.createElement('p');
    trailingParagraph.innerHTML = '<br>';

    if (range) {
      range.deleteContents();
      range.insertNode(trailingParagraph);
      range.insertNode(table);
    } else {
      this.editorCanvas.nativeElement.appendChild(table);
      this.editorCanvas.nativeElement.appendChild(trailingParagraph);
    }

    if (firstCell) {
      const cellRange = document.createRange();
      cellRange.selectNodeContents(firstCell);
      cellRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(cellRange);
      this.savedCanvasRange = cellRange.cloneRange();
    }
  }

  applyTextStyle(style: string): void {
    this.restoreCanvasSelection();
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
    this.restoreCanvasSelection();
    this.selectedFontFamily = fontFamily;
    document.execCommand('fontName', false, fontFamily);
    this.onCanvasInput();
  }

  toggleSelectedFormat(format: 'bold' | 'italic' | 'underline' | 'border'): void {
    if (format === 'border') {
      return; 
    }
    this.restoreCanvasSelection();
    document.execCommand(format, false, '');
    this.onCanvasInput();
  }

  changeSelectedFontSize(delta: number): void {
    const newSize = this.clampFontSize(this.readCurrentSelectionFontSize() + delta);
    this.applyFontSizeToCanvasSelection(newSize);
  }

  setSelectedFontSize(size: number): void {
    const numericSize = Number(size);
    if (!Number.isFinite(numericSize)) { return; }
    this.applyFontSizeToCanvasSelection(this.clampFontSize(numericSize));
  }

  rememberCanvasSelection(): void {
    if (!this.editorCanvas) { return; }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) { return; }
    const range = selection.getRangeAt(0);
    if (!this.editorCanvas.nativeElement.contains(range.commonAncestorContainer)) { return; }

    this.savedCanvasRange = range.cloneRange();
    this.selectedFontSize = this.readFontSizeFromRange(range);
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    this.rememberCanvasSelection();
  }

  private restoreCanvasSelection(): boolean {
    if (!this.editorCanvas || !this.savedCanvasRange) { return false; }
    const selection = window.getSelection();
    if (!selection) { return false; }

    this.editorCanvas.nativeElement.focus();
    selection.removeAllRanges();
    selection.addRange(this.savedCanvasRange);
    return true;
  }

  private readCurrentSelectionFontSize(): number {
    if (this.restoreCanvasSelection()) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        return this.readFontSizeFromRange(selection.getRangeAt(0));
      }
    }

    return this.selectedFontSize;
  }

  private readFontSizeFromRange(range: Range): number {
    const selectedElement = this.getFullySelectedFontSizeWrapper(range) ?? this.getSingleSelectedElement(range);
    if (selectedElement) {
      const selectedSize = parseInt(window.getComputedStyle(selectedElement).fontSize, 10);
      if (Number.isFinite(selectedSize) && selectedSize > 0) {
        return selectedSize;
      }
    }

    const el = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const currentSize = el ? parseInt(window.getComputedStyle(el).fontSize, 10) : this.selectedFontSize;
    return Number.isFinite(currentSize) && currentSize > 0 ? currentSize : this.selectedFontSize;
  }

  private clampFontSize(size: number): number {
    return Math.min(72, Math.max(6, Math.round(size)));
  }

  private applyFontSizeToCanvasSelection(size: number): void {
    this.selectedFontSize = size;
    if (!this.restoreCanvasSelection()) { return; }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) { return; }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      document.execCommand('fontSize', false, '7');
      const fonts = this.editorCanvas?.nativeElement.querySelectorAll('font[size="7"]');
      fonts?.forEach((f: Element) => {
        (f as HTMLElement).removeAttribute('size');
        (f as HTMLElement).style.fontSize = size + 'px';
      });
    } else {
      this.wrapRangeWithFontSize(range, size);
    }

    this.onCanvasInput();
    this.rememberCanvasSelection();
  }

  private wrapRangeWithFontSize(range: Range, size: number): void {
    const existingWrapper = this.getFullySelectedFontSizeWrapper(range);
    if (existingWrapper) {
      existingWrapper.style.fontSize = `${size}px`;
      this.selectElementContents(existingWrapper);
      return;
    }

    const span = document.createElement('span');
    span.dataset['fontSizeWrapper'] = 'true';
    span.style.fontSize = `${size}px`;
    span.appendChild(range.extractContents());
    this.clearNestedFontSizes(span);
    range.insertNode(span);
    this.selectElementContents(span);
  }

  private getSingleSelectedElement(range: Range): HTMLElement | null {
    if (
      range.startContainer === range.endContainer &&
      range.startContainer instanceof Node &&
      range.startContainer.nodeType === Node.ELEMENT_NODE &&
      range.endOffset === range.startOffset + 1
    ) {
      const child = range.startContainer.childNodes.item(range.startOffset);
      return child instanceof HTMLElement ? child : null;
    }

    return null;
  }

  private getFullySelectedFontSizeWrapper(range: Range): HTMLElement | null {
    const element = range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    const wrapper = element?.closest<HTMLElement>('[data-font-size-wrapper="true"]');
    if (!wrapper) { return null; }

    const wrapperRange = document.createRange();
    wrapperRange.selectNodeContents(wrapper);
    const isSameSelection =
      range.compareBoundaryPoints(Range.START_TO_START, wrapperRange) === 0 &&
      range.compareBoundaryPoints(Range.END_TO_END, wrapperRange) === 0;
    wrapperRange.detach();

    return isSameSelection ? wrapper : null;
  }

  private selectElementContents(element: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection) { return; }

    const nextRange = document.createRange();
    nextRange.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    this.savedCanvasRange = nextRange.cloneRange();
  }

  private clearNestedFontSizes(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[style], font').forEach((element) => {
      element.style.fontSize = '';
      element.removeAttribute('size');
      element.removeAttribute('data-font-size-wrapper');
      if (element.getAttribute('style') === '') {
        element.removeAttribute('style');
      }
    });
  }

  deleteSelectedBlock(): void {
    // No-op in canvas mode; selectedBlock is always null.
  }

  isOrientationDropdownOpen = false;
  isMarginDropdownOpen = false;
  isTextStyleDropdownOpen = false;
  isFontFamilyDropdownOpen = false;
  isPageBreakDropdownOpen = false;
  isTablePickerOpen = false;
  tablePickerRowsSelected = 1;
  tablePickerColumnsSelected = 1;
  isMarginLinked = true;

  private closeToolbarDropdowns(except?: 'margin' | 'orientation' | 'textStyle' | 'fontFamily' | 'pageBreak' | 'table'): void {
    if (except !== 'margin') { this.isMarginDropdownOpen = false; }
    if (except !== 'orientation') { this.isOrientationDropdownOpen = false; }
    if (except !== 'textStyle') { this.isTextStyleDropdownOpen = false; }
    if (except !== 'fontFamily') { this.isFontFamilyDropdownOpen = false; }
    if (except !== 'pageBreak') { this.isPageBreakDropdownOpen = false; }
    if (except !== 'table') { this.isTablePickerOpen = false; }
  }

  toggleMarginDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.closeToolbarDropdowns('margin');
    this.isMarginDropdownOpen = !this.isMarginDropdownOpen;
  }

  toggleOrientationDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.closeToolbarDropdowns('orientation');
    this.isOrientationDropdownOpen = !this.isOrientationDropdownOpen;
  }

  toggleTextStyleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.closeToolbarDropdowns('textStyle');
    this.isTextStyleDropdownOpen = !this.isTextStyleDropdownOpen;
  }

  toggleFontFamilyDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.closeToolbarDropdowns('fontFamily');
    this.isFontFamilyDropdownOpen = !this.isFontFamilyDropdownOpen;
  }

  togglePageBreakDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.closeToolbarDropdowns('pageBreak');
    this.isPageBreakDropdownOpen = !this.isPageBreakDropdownOpen;
  }

  toggleTablePicker(event: MouseEvent): void {
    event.stopPropagation();
    this.rememberCanvasSelection();
    this.closeToolbarDropdowns('table');
    this.isTablePickerOpen = !this.isTablePickerOpen;
    if (this.isTablePickerOpen) {
      this.setTablePickerSize(1, 1);
    }
  }

  setTablePickerSize(rows: number, columns: number): void {
    this.tablePickerRowsSelected = rows;
    this.tablePickerColumnsSelected = columns;
  }

  selectOrientation(orientation: 'portrait' | 'landscape'): void {
    this.setOrientation(orientation);
    this.isOrientationDropdownOpen = false;
  }

  selectTextStyle(style: string): void {
    this.applyTextStyle(style);
    this.isTextStyleDropdownOpen = false;
  }

  selectFontFamily(fontFamily: string): void {
    this.applyFontFamily(fontFamily);
    this.isFontFamilyDropdownOpen = false;
  }

  selectPageBreakField(fieldKey: string | null): void {
    if (!this.employeeTemplate) { return; }
    this.employeeTemplate = {
      ...this.employeeTemplate,
      pageBreakFieldKey: fieldKey
    };
    this.isPageBreakDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.closeToolbarDropdowns();
  }

  setOrientation(orientation: 'portrait' | 'landscape'): void {
    if (!this.employeeTemplate) { return; }
    this.employeeTemplate = { ...this.employeeTemplate, orientation };
  }

  toggleMarginLinked(): void {
    this.isMarginLinked = !this.isMarginLinked;
  }

  updateMargin(side: keyof PageMargins, value: number): void {
    if (!this.employeeTemplate) { return; }
    const clamped = Math.max(0, Math.min(100, isNaN(value) ? 20 : value));
    const pageMargins = this.isMarginLinked
      ? { top: clamped, bottom: clamped, left: clamped, right: clamped }
      : { ...this.employeeTemplate.pageMargins, [side]: clamped };

    this.employeeTemplate = {
      ...this.employeeTemplate,
      pageMargins
    };
  }

  setSelectedColor(color: string): void {
    this.restoreCanvasSelection();
    document.execCommand('foreColor', false, color);
    this.onCanvasInput();
  }

  setSelectedAlign(align: 'left' | 'center' | 'right'): void {
    this.restoreCanvasSelection();
    if (align === 'left') document.execCommand('justifyLeft', false, '');
    else if (align === 'center') document.execCommand('justifyCenter', false, '');
    else if (align === 'right') document.execCommand('justifyRight', false, '');
    this.onCanvasInput();
  }
}

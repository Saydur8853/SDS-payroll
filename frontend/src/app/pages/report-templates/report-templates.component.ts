import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ReportFieldDefinition,
  ReportTemplate,
  ReportTemplateService,
  VisualReportBlock,
  VisualReportImageKind
} from '../../services/report-template.service';

@Component({
  selector: 'app-report-templates',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-templates.component.html',
  styleUrl: './report-templates.component.scss'
})
export class ReportTemplatesComponent implements OnInit {
  employeeTemplate!: ReportTemplate;
  message = '';
  selectedBlockId: string | null = null;
  activeInsertTab: 'attributes' | 'tools' = 'attributes';
  private draggedPaletteItem: { type: 'field' | 'text' | 'image'; key?: string; label: string; imageKind?: VisualReportImageKind } | null = null;
  private activeDrag: { blockId: string; offsetX: number; offsetY: number } | null = null;

  readonly fieldDefinitions: ReportFieldDefinition[];

  constructor(private readonly reportTemplateService: ReportTemplateService) {
    this.fieldDefinitions = this.reportTemplateService.employeeFieldDefinitions;
  }

  ngOnInit(): void {
    this.employeeTemplate = this.reportTemplateService.getEmployeeTemplate();
  }

  get pageWidth(): number {
    return this.employeeTemplate.orientation === 'portrait' ? 794 : 1123;
  }

  get pageHeight(): number {
    return this.employeeTemplate.orientation === 'portrait' ? 1123 : 794;
  }

  get selectedBlock(): VisualReportBlock | null {
    return this.employeeTemplate.visualBlocks.find((block) => block.id === this.selectedBlockId) ?? null;
  }

  saveTemplate(): void {
    this.employeeTemplate = this.reportTemplateService.saveEmployeeTemplate(this.employeeTemplate);
    this.message = 'Employee Info report template saved.';
  }

  resetTemplate(): void {
    if (!window.confirm('Reset Employee Info report template to default?')) {
      return;
    }

    this.employeeTemplate = this.reportTemplateService.resetEmployeeTemplate();
    this.message = 'Employee Info report template reset.';
  }

  onPaletteDragStart(event: DragEvent, item: { type: 'field' | 'text' | 'image'; key?: string; label: string; imageKind?: VisualReportImageKind }): void {
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

    const position = this.getCanvasPosition(event);
    this.addVisualBlock(this.draggedPaletteItem, position.x, position.y);
    this.draggedPaletteItem = null;
  }

  addTextBlock(): void {
    this.addVisualBlock({ type: 'text', label: 'Custom Text' }, 60, 60);
  }

  addImageBlock(imageKind: VisualReportImageKind): void {
    this.addVisualBlock({ type: 'image', imageKind, label: imageKind === 'photo' ? 'Photo' : 'Signature' }, 620, 70);
  }

  selectBlock(block: VisualReportBlock, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedBlockId = block.id;
  }

  clearBlockSelection(): void {
    this.selectedBlockId = null;
  }

  startBlockMove(block: VisualReportBlock, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const position = this.getCanvasPosition(event);
    this.activeDrag = {
      blockId: block.id,
      offsetX: position.x - block.x,
      offsetY: position.y - block.y
    };
    this.selectedBlockId = block.id;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.activeDrag) {
      return;
    }

    const block = this.employeeTemplate.visualBlocks.find((item) => item.id === this.activeDrag?.blockId);
    if (!block) {
      return;
    }

    const position = this.getCanvasPosition(event);
    block.x = this.clamp(Math.round(position.x - this.activeDrag.offsetX), 0, this.pageWidth - block.width);
    block.y = this.clamp(Math.round(position.y - this.activeDrag.offsetY), 0, this.pageHeight - block.height);
  }

  stopBlockMove(): void {
    this.activeDrag = null;
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.stopBlockMove();
  }

  deleteSelectedBlock(): void {
    if (!this.selectedBlockId) {
      return;
    }

    this.employeeTemplate.visualBlocks = this.employeeTemplate.visualBlocks.filter((block) => block.id !== this.selectedBlockId);
    this.selectedBlockId = null;
  }

  getBlockStyle(block: VisualReportBlock): Record<string, string> {
    return {
      left: `${(block.x / this.pageWidth) * 100}%`,
      top: `${(block.y / this.pageHeight) * 100}%`,
      width: `${(block.width / this.pageWidth) * 100}%`,
      height: `${(block.height / this.pageHeight) * 100}%`,
      fontSize: `${block.fontSize}px`,
      fontWeight: block.bold ? '800' : '500',
      textAlign: block.align,
      borderStyle: block.border ? 'solid' : 'dashed'
    };
  }

  getBlockPreviewText(block: VisualReportBlock): string {
    if (block.type === 'text') {
      return block.text || 'Custom Text';
    }

    if (block.type === 'image') {
      return block.imageKind === 'signature' ? 'Signature' : 'Photo';
    }

    return `${block.label}: ${this.getSampleValue(block.fieldKey ?? '')}`;
  }

  getSampleValue(fieldKey: string): string {
    if (fieldKey.startsWith('dynamic:')) {
      return 'Custom value';
    }

    return this.fieldDefinitions.find((field) => field.key === fieldKey)?.sample ?? '-';
  }

  private addVisualBlock(
    item: { type: 'field' | 'text' | 'image'; key?: string; label: string; imageKind?: VisualReportImageKind },
    x: number,
    y: number
  ): void {
    const isImage = item.type === 'image';
    const block: VisualReportBlock = {
      id: `block-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      type: item.type,
      fieldKey: item.key,
      label: item.label,
      text: item.type === 'text' ? 'Custom Text' : '',
      imageKind: item.imageKind,
      x: this.clamp(Math.round(x), 0, this.pageWidth - (isImage ? 110 : 180)),
      y: this.clamp(Math.round(y), 0, this.pageHeight - (isImage ? 120 : 34)),
      width: isImage ? (item.imageKind === 'signature' ? 160 : 110) : 190,
      height: isImage ? (item.imageKind === 'signature' ? 55 : 135) : 34,
      fontSize: item.type === 'text' ? 16 : 11,
      bold: item.type === 'text',
      align: item.type === 'image' ? 'center' : 'left',
      border: item.type === 'image'
    };

    this.employeeTemplate.visualBlocks = [...this.employeeTemplate.visualBlocks, block];
    this.selectedBlockId = block.id;
  }

  private getCanvasPosition(event: MouseEvent | DragEvent): { x: number; y: number } {
    const canvas = (event.currentTarget as HTMLElement).closest('.visual-canvas') as HTMLElement | null
      ?? document.querySelector('.visual-canvas') as HTMLElement | null;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: this.clamp(((event.clientX - rect.left) / rect.width) * this.pageWidth, 0, this.pageWidth),
      y: this.clamp(((event.clientY - rect.top) / rect.height) * this.pageHeight, 0, this.pageHeight)
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

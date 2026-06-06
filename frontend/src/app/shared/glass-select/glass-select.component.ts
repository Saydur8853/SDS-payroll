import { CommonModule } from '@angular/common';
import { Component, ElementRef, forwardRef, HostListener, Input, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';

export interface GlassSelectOption {
  label: string;
  value: string | number | boolean | null;
  variant?: 'default' | 'add';
}

@Component({
  selector: 'app-glass-select',
  imports: [CommonModule],
  templateUrl: './glass-select.component.html',
  styleUrl: './glass-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GlassSelectComponent),
      multi: true
    }
  ]
})
export class GlassSelectComponent implements ControlValueAccessor, OnDestroy {
  private static readonly opened$ = new Subject<GlassSelectComponent>();

  @Input() options: GlassSelectOption[] = [];
  @Input() placeholder = '';
  @Input() disabled = false;

  isOpen = false;
  value: string | number | boolean | null = null;

  private onChange: (value: string | number | boolean | null) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly openedSubscription: Subscription;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {
    this.openedSubscription = GlassSelectComponent.opened$.subscribe((openedSelect) => {
      if (openedSelect !== this) {
        this.isOpen = false;
      }
    });
  }

  get selectedLabel(): string {
    const selected = this.options.find(option => option.value === this.value);
    return selected?.label || this.placeholder;
  }

  writeValue(value: string | number | boolean | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: string | number | boolean | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.isOpen = false;
    }
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      GlassSelectComponent.opened$.next(this);
    }
    this.onTouched();
  }

  select(option: GlassSelectOption): void {
    if (this.disabled) {
      return;
    }

    this.value = option.value;
    this.isOpen = false;
    this.onChange(option.value);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
    }
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    event.preventDefault();
    this.isOpen = false;
  }

  ngOnDestroy(): void {
    this.openedSubscription.unsubscribe();
  }
}

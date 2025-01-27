import { NgIf, NgFor } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, Output, EventEmitter, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent {
  @Input() placeholder: string = 'Buscar...';
  @Input() suggestions: string[] = [];
  @Output() search = new EventEmitter<string>();
  @Output() selected = new EventEmitter<string>();

  searchControl = new FormControl('');
  showClearButton = false;
  showSuggestions = false;
  isSearchFocused = false;

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.search.emit(value || '');
      this.showClearButton = !!value;
      this.showSuggestions = !!value && this.isSearchFocused;
    });
  }

  onFocus() {
    this.isSearchFocused = true;
    this.showSuggestions = !!this.searchControl.value;
  }

  onBlur() {
    setTimeout(() => {
      this.isSearchFocused = false;
      this.showSuggestions = false;
    }, 200);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.showClearButton = false;
    this.showSuggestions = false;
  }

  selectSuggestion(suggestion: string) {
    this.searchControl.setValue(suggestion);
    this.selected.emit(suggestion);
    this.showSuggestions = false;
  }
}

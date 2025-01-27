import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchComponent } from './search.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('SearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchComponent, ReactiveFormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit search value on input', (done) => {
    const testValue = 'test search';
    
    component.search.subscribe(value => {
      expect(value).toBe(testValue);
      done();
    });

    component.searchControl.setValue(testValue);
  });

  it('should clear search when clearSearch is called', () => {
    component.searchControl.setValue('test');
    component.clearSearch();
    
    expect(component.searchControl.value).toBe('');
    expect(component.showClearButton).toBeFalse();
    expect(component.showSuggestions).toBeFalse();
  });

  it('should show suggestions on focus with value', () => {
    component.searchControl.setValue('test');
    component.onFocus();
    
    expect(component.showSuggestions).toBeTrue();
  });

  it('should hide suggestions on blur', (done) => {
    component.onBlur();
    
    setTimeout(() => {
      expect(component.showSuggestions).toBeFalse();
      done();
    }, 201);
  });

  it('should emit selected suggestion', () => {
    const testSuggestion = 'test suggestion';
    spyOn(component.selected, 'emit');
    
    component.selectSuggestion(testSuggestion);
    
    expect(component.selected.emit).toHaveBeenCalledWith(testSuggestion);
    expect(component.searchControl.value).toBe(testSuggestion);
  });
});
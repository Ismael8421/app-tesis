import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EyeButtonComponent } from './eye-button.component';

describe('EyeButtonComponent', () => {
  let component: EyeButtonComponent;
  let fixture: ComponentFixture<EyeButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EyeButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EyeButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

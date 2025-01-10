import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StyleWorkComponent } from './style-work.component';

describe('StyleWorkComponent', () => {
  let component: StyleWorkComponent;
  let fixture: ComponentFixture<StyleWorkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StyleWorkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StyleWorkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

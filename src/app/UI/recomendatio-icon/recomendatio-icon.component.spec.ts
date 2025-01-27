import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecomendatioIconComponent } from './recomendatio-icon.component';

describe('RecomendatioIconComponent', () => {
  let component: RecomendatioIconComponent;
  let fixture: ComponentFixture<RecomendatioIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecomendatioIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecomendatioIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

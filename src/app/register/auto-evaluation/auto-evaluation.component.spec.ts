import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoEvaluationComponent } from './auto-evaluation.component';

describe('AutoEvaluationComponent', () => {
  let component: AutoEvaluationComponent;
  let fixture: ComponentFixture<AutoEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoEvaluationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutoEvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

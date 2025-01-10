import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WantedSkillsComponent } from './wanted-skills.component';

describe('WantedSkillsComponent', () => {
  let component: WantedSkillsComponent;
  let fixture: ComponentFixture<WantedSkillsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WantedSkillsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WantedSkillsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangePwsEmailComponent } from './change-pws-email.component';

describe('ChangePwsEmailComponent', () => {
  let component: ChangePwsEmailComponent;
  let fixture: ComponentFixture<ChangePwsEmailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangePwsEmailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChangePwsEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

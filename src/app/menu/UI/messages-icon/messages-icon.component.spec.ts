import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagesIconComponent } from './messages-icon.component';

describe('MessagesIconComponent', () => {
  let component: MessagesIconComponent;
  let fixture: ComponentFixture<MessagesIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagesIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagesIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

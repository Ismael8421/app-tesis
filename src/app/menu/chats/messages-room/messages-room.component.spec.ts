import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessagesRoomComponent } from './messages-room.component';

describe('MessagesRoomComponent', () => {
  let component: MessagesRoomComponent;
  let fixture: ComponentFixture<MessagesRoomComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessagesRoomComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MessagesRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecomendatioIconComponent } from '../../UI/recomendatio-icon/recomendatio-icon.component';

@Component({
  selector: 'app-messages-room',
  standalone: true,
  imports: [RouterLink, RecomendatioIconComponent],
  templateUrl: './messages-room.component.html',
  styleUrl: './messages-room.component.css'
})
export class MessagesRoomComponent {

}
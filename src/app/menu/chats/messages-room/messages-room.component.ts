import { Component, inject } from '@angular/core';
import { RecomendatioIconComponent } from '../../UI/recomendatio-icon/recomendatio-icon.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-messages-room',
  standalone: true,
  imports: [RecomendatioIconComponent],
  templateUrl: './messages-room.component.html',
  styleUrl: './messages-room.component.css'
})
export class MessagesRoomComponent {
  private _router = inject(Router);

  navigateTo() {
    this._router.navigateByUrl('/menu/mensajes');
  }
}
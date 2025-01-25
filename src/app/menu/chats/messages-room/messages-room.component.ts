import { Component, inject } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RecomendatioIconComponent } from '../../UI/recomendatio-icon/recomendatio-icon.component';

@Component({
  selector: 'app-messages-room',
  standalone: true,
  imports: [RecomendatioIconComponent, IonicModule, CommonModule],
  templateUrl: './messages-room.component.html',
  styleUrl: './messages-room.component.scss'
})
export class MessagesRoomComponent {
  private _router = inject(Router);

  navigateTo() {
    this._router.navigateByUrl('/menu/mensajes');
  }
} 
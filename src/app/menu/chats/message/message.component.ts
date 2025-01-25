import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackIconComponent } from '../../UI/back-icon/back-icon.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [CommonModule, FormsModule, BackIconComponent],
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
})
export class MessageComponent {
  private _router = inject(Router);

  goBack() {
    this._router.navigateByUrl('/menu/chats')
  }

  mensaje: string = '';

  enviar_mensaje() {
    console.log(this.mensaje);
  }
}

import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [BackIconComponent, IonicModule, CommonModule, FormsModule],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss'
})
export class MessageComponent {
  mensaje: string = '';
  avatarUrl: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Optional: get ID from route
    const id = this.route.snapshot.paramMap.get('id');
  }

  goBack() {
    this.router.navigateByUrl('/menu/chats');
  }

  enviar_mensaje() {
    console.log(this.mensaje);
    // Implement message sending logic
  }
}
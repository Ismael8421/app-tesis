import { Component, OnInit, inject } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RecomendatioIconComponent } from '../../../UI/recomendatio-icon/recomendatio-icon.component';

@Component({
  selector: 'app-messages-room',
  templateUrl: './messages-room.component.html',
  styleUrls: ['./messages-room.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RecomendatioIconComponent]
})
export class MessagesRoomComponent implements OnInit {
  private chatService = inject(ChatService);
  private auth = inject(Auth);
  private router = inject(Router);

  chats$: Observable<any[]> = of([]);
  currentUser: any = null;

  ngOnInit() {
    // Suscripción a cambios en el estado de autenticación
    this.auth.onAuthStateChanged(user => {
      this.currentUser = user;
      if (user) {
        this.chats$ = this.chatService.getUserChats(user.uid);
      }
    });
  }

  navigateTo(chatId: string) {
    if (!chatId) {
      console.error('No chat ID provided');
      return;
    }
    console.log('Navigating to chat:', chatId);
    this.router.navigate(['/menu/mensajes', chatId]);
  }

  getUserName(participants: string[]): string {
    if (!this.auth.currentUser) return '';
    
    const otherUserId = participants.find(id => id !== this.auth.currentUser?.uid);
    return otherUserId === 'edcYJuV03NfrH46iw26FZ02oo3m2' ? 'IsmaelP2007' : 'fabianB94';
  }
}
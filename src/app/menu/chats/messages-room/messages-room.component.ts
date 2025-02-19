import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { Auth } from '@angular/fire/auth';
import { Observable, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RecomendatioIconComponent } from '../../../UI/recomendatio-icon/recomendatio-icon.component';
import { IonAvatar, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { RegisterService } from '../../../register/data-access/register.service';

@Component({
  selector: 'app-messages-room',
  templateUrl: './messages-room.component.html',
  styleUrls: ['./messages-room.component.scss'],
  standalone: true,
  imports: [CommonModule, RecomendatioIconComponent, IonContent, IonList, IonItem, IonAvatar, IonLabel]
})
export class MessagesRoomComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private auth = inject(Auth);
  private router = inject(Router);
  private registerService = inject(RegisterService);
  private chatsSubscription?: Subscription;

  chats$: Observable<any[]>;
  currentUser: any = null;
  userNames: { [key: string]: string } = {};

  constructor() {
    this.chats$ = this.chatService.getUserChatsRealtime(this.auth.currentUser?.uid || '');
  }

  ngOnInit() {
    this.auth.onAuthStateChanged(user => {
      this.currentUser = user;
      if (user) {
        // Actualizar la suscripción en tiempo real
        if (this.chatsSubscription) {
          this.chatsSubscription.unsubscribe();
        }
        this.chats$ = this.chatService.getUserChatsRealtime(user.uid);
        
        this.chatsSubscription = this.chats$.subscribe(async (chats) => {
          for (const chat of chats) {
            for (const participantId of chat.participants) {
              if (!this.userNames[participantId] && participantId !== user.uid) {
                try {
                  const userData = await this.registerService.getUserData(participantId);
                  if (userData) {
                    this.userNames[participantId] = `${userData.nombre} ${userData.apellido}`;
                  }
                } catch (error) {
                  console.error('Error obteniendo datos del usuario:', error);
                }
              }
            }
          }
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.chatsSubscription) {
      this.chatsSubscription.unsubscribe();
    }
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
    if (!otherUserId) return 'Usuario';
    
    return this.userNames[otherUserId] || 'Cargando...';
  }
}
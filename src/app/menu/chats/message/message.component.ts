import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { Observable, from, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ChatService } from '../data-access/chat.service';
import { UserStatusService } from '../data-access/userstatus.service';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { IonAvatar, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { RegisterService } from '../../../register/data-access/register.service';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, BackIconComponent, IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonAvatar, IonInput, IonButton]
})
export class MessageComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private chatService = inject(ChatService);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private registerService = inject(RegisterService);
  private userStatusService = inject(UserStatusService);
  private messagesSubscription?: Subscription;
  private markAsReadInterval: any;

  mensaje: string = '';
  messages$: Observable<any>;
  currentUser = this.auth.currentUser;
  otherUserName: string = 'Usuario';
  chatData$: Observable<any>;

  constructor() {
    const chatId = this.route.snapshot.paramMap.get('id') || '';
    this.messages$ = this.chatService.getMessagesRealtime(chatId);
    
    this.chatData$ = from(this.chatService.getChat(chatId)).pipe(
      switchMap(async (chat) => {
        if (!chat || !this.currentUser) return { chat, otherUserName: 'Usuario' };
        
        const otherUserId = chat.participants.find(id => id !== this.currentUser?.uid);
        if (!otherUserId) return { chat, otherUserName: 'Usuario' };

        try {
          const userData = await this.registerService.getUserData(otherUserId);
          const otherUserName = userData ? userData.nombreUsuario || 'Usuario' : 'Usuario';
          return { chat, otherUserName };
        } catch (error) {
          console.error('Error getting user data:', error);
          return { chat, otherUserName: 'Usuario' };
        }
      })
    );
  }

  ngOnInit() {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const chatId = this.getChatId();
    
    // Actualizar el estado del usuario para indicar que está activo en este chat
    this.userStatusService.refreshStatus();
    
    // Suscripción a los mensajes en tiempo real
    this.messagesSubscription = this.messages$.subscribe(() => {
      setTimeout(() => {
        this.scrollToBottom();
        this.markMessagesAsRead();
      }, 100);
    });

    // Configurar un intervalo para marcar mensajes como leídos periódicamente
    this.markAsReadInterval = setInterval(() => {
      if (document.hasFocus()) {
        this.markMessagesAsRead();
      }
    }, 2000);

    // Marcar mensajes como leídos al entrar al chat
    this.markMessagesAsRead();
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    if (this.markAsReadInterval) {
      clearInterval(this.markAsReadInterval);
    }
    // Asegurarse de marcar los mensajes como leídos al salir
    this.markMessagesAsRead();
    
    // Actualizar estado al salir de la conversación
    this.userStatusService.refreshStatus();
  }

  private scrollToBottom(): void {
    try {
      const element = this.scrollContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private async markMessagesAsRead() {
    if (!this.currentUser) return;
    
    const chatId = this.getChatId();
    try {
      await this.chatService.markMessagesAsRead(chatId, this.currentUser.uid);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private getChatId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }

  async enviar_mensaje() {
    if (!this.mensaje.trim() || !this.currentUser) return;

    try {
      await this.chatService.sendMessage(
        this.getChatId(),
        this.currentUser.uid,
        this.currentUser.displayName || 'Usuario',
        this.mensaje
      );
      this.mensaje = '';
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  goBack() {
    this.router.navigate(['/menu/chats']);
  }
}
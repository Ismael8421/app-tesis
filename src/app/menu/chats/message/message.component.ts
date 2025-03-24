import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { Observable, from, Subscription, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { ChatService } from '../data-access/chat.service';
import { ChatStorageService } from '../data-access/chat-storage.service';
import { NetworkService } from '../data-access/network.service';
import { UserStatusService } from '../data-access/userstatus.service';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { IonAvatar, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, 
  IonTitle, IonToolbar, IonSpinner, IonRefresher, IonRefresherContent, 
  IonIcon} from '@ionic/angular/standalone';
import { RegisterService } from '../../../register/data-access/register.service';
import { ThemeService } from '../../configs/settings/data-access/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, BackIconComponent, IonContent, IonHeader, IonToolbar, 
    IonButtons, IonBackButton, IonTitle, IonAvatar, IonInput, IonButton, IonSpinner, 
    IonRefresher, IonRefresherContent, IonIcon]
})
export class MessageComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private chatService = inject(ChatService);
  private storageService = inject(ChatStorageService);
  private networkService = inject(NetworkService);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private registerService = inject(RegisterService);
  private userStatusService = inject(UserStatusService);
  private _themeService = inject(ThemeService);
  
  private messagesSubscription?: Subscription;
  private networkSubscription?: Subscription;
  private markAsReadInterval: any;

  mensaje: string = '';
  messages$: Observable<any[]>;
  currentUser = this.auth.currentUser;
  otherUserName: string = 'Usuario';
  chatData$: Observable<any>;
  
  // Variables para UI
  isOnline: boolean = true;
  isLoading: boolean = true;
  isSending: boolean = false;
  isDarkMode: boolean = false;
  
  constructor() {
    const chatId = this.route.snapshot.paramMap.get('id') || '';
    
    // Usar mensajes con caché
    this.messages$ = this.chatService.getMessagesRealtime(chatId);
    
    this.chatData$ = from(this.chatService.getChat(chatId)).pipe(
      switchMap(async (chat) => {
        if (!chat || !this.currentUser) return { chat, otherUserName: 'Usuario' };
        
        const otherUserId = chat.participants.find(id => id !== this.currentUser?.uid);
        if (!otherUserId) return { chat, otherUserName: 'Usuario' };

        try {
          // Intentar obtener datos del usuario de la caché primero
          const cachedNames = await this.storageService.getUserNames();
          const cachedName = cachedNames[otherUserId];
          
          if (cachedName) {
            return { chat, otherUserName: cachedName };
          }
          
          // Si no está en caché, obtener de Firebase
          const userData = await this.registerService.getUserData(otherUserId);
          const otherUserName = userData ? userData.nombreUsuario || 'Usuario' : 'Usuario';
          
          // Guardar en caché
          if (otherUserName && otherUserName !== 'Usuario') {
            const namesUpdate = { [otherUserId]: otherUserName };
            await this.storageService.saveUserNames(namesUpdate);
          }
          
          return { chat, otherUserName };
        } catch (error) {
          console.error('Error getting user data:', error);
          return { chat, otherUserName: 'Usuario' };
        }
      })
    );
    
    // Suscribirse a cambios de tema
    this._themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateDarkModeStatus();
      });
  }

  ngOnInit() {
    // Inicializar el estado del tema
    this.updateDarkModeStatus();
    
    // Suscribirse a cambios en la conectividad
    this.networkSubscription = this.networkService.isOnline$.subscribe(isOnline => {
      this.isOnline = isOnline;
    });
    
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const chatId = this.getChatId();
    
    // Actualizar el estado del usuario para indicar que está activo en este chat
    this.userStatusService.refreshStatus();
    
    // Suscripción a los mensajes en tiempo real
    this.messagesSubscription = this.messages$.subscribe(messages => {
      this.isLoading = false;
      
      setTimeout(() => {
        this.scrollToBottom();
        this.markMessagesAsRead();
      }, 100);
    });

    // Configurar un intervalo para marcar mensajes como leídos periódicamente
    this.markAsReadInterval = setInterval(() => {
      if (document.hasFocus() && this.isOnline) {
        this.markMessagesAsRead();
      }
    }, 2000);

    // Marcar mensajes como leídos al entrar al chat
    this.markMessagesAsRead();
  }
  
  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
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
    if (!this.currentUser || !this.isOnline) return;
    
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
    
    // Si no hay conexión, mostrar mensaje
    if (!this.isOnline) {
      alert('No tienes conexión a Internet. No es posible enviar mensajes sin conexión.');
      return;
    }

    try {
      this.isSending = true;
      
      await this.chatService.sendMessage(
        this.getChatId(),
        this.currentUser.uid,
        this.currentUser.displayName || 'Usuario',
        this.mensaje
      );
      
      this.mensaje = '';
      this.isSending = false;
      
      // Asegurar que los mensajes se actualicen
      this.chatService.forceRefreshMessages();
      
      // Scroll al fondo para ver el mensaje nuevo
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      this.isSending = false;
      
      // Mostrar mensaje de error
      alert('Error al enviar el mensaje. Por favor, inténtalo de nuevo.');
    }
  }

  goBack() {
    this.router.navigate(['/menu/chats']);
  }
  
  // Método para el pull-to-refresh
  handleRefresh(event: any) {
    if (this.isOnline) {
      // Forzar actualización de los mensajes
      this.chatService.forceRefreshMessages();
      
      // Completar el evento de refresco después de un breve retraso
      setTimeout(() => {
        event.target.complete();
      }, 1000);
    } else {
      // Si no hay conexión, simplemente completar el refresco
      event.target.complete();
    }
  }
}
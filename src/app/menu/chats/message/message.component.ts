// Modificaciones en message.component.ts
import { UserProfileService } from '../../../core/services/user-profile.service';
import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { Observable, from, Subscription, of, BehaviorSubject } from 'rxjs';
import { map, switchMap, tap, catchError, filter } from 'rxjs/operators';
import { ChatService } from '../data-access/chat.service';
import { ChatStorageService } from '../data-access/chat-storage.service';
import { NetworkService } from '../data-access/network.service';
import { UserStatusService } from '../data-access/userstatus.service';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import {
  IonAvatar, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput,
  IonTitle, IonToolbar, IonSpinner, IonRefresher, IonRefresherContent,
  IonIcon
} from '@ionic/angular/standalone';
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
  private userProfileService = inject(UserProfileService);
  private subscriptions: Subscription[] = [];
  private markAsReadInterval: any;

  otherUserProfileImage: string | null = null;
  otherUserId: string | null = null;

  mensaje: string = '';
  currentUser = this.auth.currentUser;
  otherUserName: string = 'Usuario';
  chatData$: Observable<any>;

  // Estado de mensajes con BehaviorSubject
  allMessages = new BehaviorSubject<any[]>([]);

  // Variables para UI
  isOnline: boolean = true;
  isLoading: boolean = true;
  isSending: boolean = false;
  isDarkMode: boolean = false;

  constructor() {
    const chatId = this.route.snapshot.paramMap.get('id') || '';

    this.chatData$ = from(this.chatService.getChat(chatId)).pipe(
      switchMap(async (chat) => {
        if (!chat || !this.currentUser) return { chat, otherUserName: 'Usuario' };
        
        const otherUserId = chat.participants.find(id => id !== this.currentUser?.uid);
        this.otherUserId = otherUserId || null;
        
        if (!otherUserId) return { chat, otherUserName: 'Usuario' };
    
        try {
          // Intentar obtener datos del usuario de la caché primero
          const cachedNames = await this.storageService.getUserNames();
          const cachedName = cachedNames[otherUserId];
          
          // Obtener la imagen de perfil
          this.userProfileService.getProfileImageUrl(otherUserId).subscribe(imageUrl => {
            this.otherUserProfileImage = imageUrl;
          });
          
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
    this.subscriptions.push(
      this.networkService.isOnline$.subscribe(isOnline => {
        this.isOnline = isOnline;
      })
    );
  
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
  
    const chatId = this.getChatId();
  
    // Actualizar el estado del usuario para indicar que está activo en este chat
    this.userStatusService.refreshStatus();
  
    // Cargar mensajes iniciales y suscribirse a actualizaciones
    this.loadMessages();
  
    // Suscribirse a eventos de mensajes nuevos
    this.subscriptions.push(
      this.chatService.messageAddedEvent$
        .pipe(filter(event => event.chatId === chatId))
        .subscribe(event => {
          // Comprobar si el mensaje ya está en la lista
          const currentMessages = this.allMessages.value;
          const messageExists = currentMessages.some(m => m.id === event.message.id);
  
          if (!messageExists) {
            // Añadir el nuevo mensaje a la lista
            const updatedMessages = [...currentMessages, event.message];
            this.allMessages.next(updatedMessages);
  
            // Desplazar al final
            setTimeout(() => this.scrollToBottom(), 100);
            
            // Marcar mensajes como leídos inmediatamente si estamos en el chat
            if (document.hasFocus() && this.isOnline) {
              this.markMessagesAsRead();
            }
          }
        })
    );
  
    // Configurar un intervalo para marcar mensajes como leídos periódicamente
    this.markAsReadInterval = setInterval(() => {
      if (document.hasFocus() && this.isOnline) {
        this.markMessagesAsRead();
      }
    }, 2000);
  
    // Marcar mensajes como leídos al entrar al chat - múltiples intentos
    // Primer intento inmediato
    this.markMessagesAsRead();
    
    // Segundo intento después de 500ms
    setTimeout(() => this.markMessagesAsRead(), 500);
    
    // Tercer intento después de la carga de mensajes (normalmente 1-2 segundos)
    setTimeout(() => this.markMessagesAsRead(), 2000);
  }

  // Cargar mensajes iniciales
  private loadMessages() {
    const chatId = this.getChatId();
  
    // Mostrar carga
    this.isLoading = true;
  
    // Suscribirse a los mensajes
    this.subscriptions.push(
      this.chatService.getMessages(chatId).subscribe({
        next: (messages) => {
          this.isLoading = false;
          this.allMessages.next(messages);
  
          // Desplazar al final después de cargar mensajes
          setTimeout(() => this.scrollToBottom(), 100);
  
          // Marcar mensajes como leídos después de cargar
          if (this.isOnline && this.currentUser) {
            setTimeout(() => this.markMessagesAsRead(), 300);
          }
        },
        error: (error) => {
          console.error('Error loading messages:', error);
          this.isLoading = false;
        }
      })
    );
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());

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
      console.log('Marcando mensajes como leídos al entrar/interactuar con el chat');
      await this.chatService.markMessagesAsRead(chatId, this.currentUser.uid);
      
      // Forzar actualización de UI para reflejar cambios inmediatamente
      this.chatService.forceRefreshChats();
      
      // Forzar refrescar mensajes también
      this.chatService.forceRefreshMessages();
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

    // Guardar el texto del mensaje
    const mensajeTexto = this.mensaje.trim();

    try {
      // Mostrar estado de envío
      this.isSending = true;

      // Limpiar input inmediatamente
      this.mensaje = '';

      // Crear mensaje temporal para mostrar inmediatamente
      const timestamp = Date.now();
      const tempMessage = {
        content: mensajeTexto,
        senderId: this.currentUser.uid,
        senderName: this.currentUser.displayName || 'Usuario',
        timestamp: timestamp,
        readBy: { [this.currentUser.uid]: true },
        id: 'temp-' + timestamp,
        isTemp: true
      };

      // Añadir mensaje temporal a la lista
      const currentMessages = this.allMessages.value;
      this.allMessages.next([...currentMessages, tempMessage]);

      // Scroll para mostrar el mensaje temporal
      setTimeout(() => this.scrollToBottom(), 50);

      // Enviar mensaje a Firebase
      const messageId = await this.chatService.sendMessage(
        this.getChatId(),
        this.currentUser.uid,
        this.currentUser.displayName || 'Usuario',
        mensajeTexto
      );

      // Actualizar estado
      this.isSending = false;

      // Reemplazar mensaje temporal con el real
      const updatedMessages = this.allMessages.value.map(msg => {
        if (msg.id === tempMessage.id) {
          return {
            ...msg,
            id: messageId,
            isTemp: false
          };
        }
        return msg;
      });

      this.allMessages.next(updatedMessages);

      // Scroll para asegurar visibilidad
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      this.isSending = false;

      // Restaurar mensaje si hay error
      this.mensaje = mensajeTexto;

      // Mostrar error
      alert('Error al enviar el mensaje. Por favor, inténtalo de nuevo.');
    }
  }

  goBack() {
    this.router.navigate(['/menu/chats']);
  }

  // Método para el pull-to-refresh
  handleRefresh(event: any) {
    if (this.isOnline) {
      // Recargar mensajes
      this.loadMessages();

      // Completar el evento de refresco
      setTimeout(() => {
        event.target.complete();
      }, 1000);
    } else {
      // Si no hay conexión, simplemente completar
      event.target.complete();
    }
  }

  handleProfileImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = 'icons/logo_tesis.png';
    }
  }
}
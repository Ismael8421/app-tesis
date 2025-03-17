import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { Auth } from '@angular/fire/auth';
import { Observable, Subscription, interval } from 'rxjs';
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
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  
  private chatsSubscription?: Subscription;
  private authStateSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  
  // Intervalo de refresco en milisegundos (15 segundos)
  private REFRESH_INTERVAL = 15000;

  // Lista directa de chats
  chats: any[] = [];
  
  currentUser: any = null;
  userNames: { [key: string]: string } = {};

  ngOnInit() {
    // Suscribirse a los cambios de autenticación
    this.authStateSubscription = new Observable<any>(observer => {
      return this.auth.onAuthStateChanged(
        user => this.zone.run(() => observer.next(user)),
        error => this.zone.run(() => observer.error(error))
      );
    }).subscribe(user => {
      console.log('Auth state changed:', user?.uid);
      this.currentUser = user;
      
      // Cuando cambia el usuario, actualizar la suscripción de chats
      this.setupChatsSubscription();
      
      // Configurar refresco periódico
      this.setupPeriodicRefresh();
    });
  }

  private setupPeriodicRefresh() {
    // Limpiar la suscripción anterior si existe
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    
    // Si no hay usuario, no configuramos el refresco
    if (!this.currentUser) return;
    
    // Refrescar cada X segundos (definido por REFRESH_INTERVAL)
    this.refreshSubscription = interval(this.REFRESH_INTERVAL).subscribe(() => {
      this.fetchChatsData();
    });
  }

  private setupChatsSubscription() {
    // Limpiar suscripción anterior si existe
    if (this.chatsSubscription) {
      this.chatsSubscription.unsubscribe();
    }
    
    // Si no hay usuario, no hacemos nada
    if (!this.currentUser) {
      this.chats = [];
      return;
    }
    
    // Realizar la obtención inicial de datos
    this.fetchChatsData();
  }
  
  private fetchChatsData() {
    if (!this.currentUser) return;
    
    // Limpiar suscripción anterior si existe
    if (this.chatsSubscription) {
      this.chatsSubscription.unsubscribe();
    }
    
    // Crear nueva suscripción
    this.chatsSubscription = this.chatService.getUserChatsRealtime(this.currentUser.uid)
      .subscribe({
        next: (chats) => {
          // Verificar si hay cambios en los chats antes de actualizar
          const hasChanges = this.detectChangesInChats(chats);
          
          if (hasChanges) {
            // Actualizar directamente la propiedad chats
            this.zone.run(() => {
              this.chats = chats;
              
              // Forzar la detección de cambios
              this.cdr.detectChanges();
              this.appRef.tick();
              
              // Cargar nombres de usuario para los chats
              this.loadUserNames(chats);
            });
          }
        },
        error: (error) => console.error('Error in chats subscription:', error)
      });
  }
  
  // Método para detectar cambios en los chats
  private detectChangesInChats(newChats: any[]): boolean {
    if (this.chats.length !== newChats.length) {
      return true;
    }
    
    // Comparar timestamps de últimos mensajes
    for (const newChat of newChats) {
      const existingChat = this.chats.find(chat => chat.id === newChat.id);
      if (!existingChat || 
          existingChat.lastMessageTimestamp !== newChat.lastMessageTimestamp || 
          existingChat.lastMessage !== newChat.lastMessage ||
          JSON.stringify(existingChat.unreadMessages) !== JSON.stringify(newChat.unreadMessages)) {
        return true;
      }
    }
    
    return false;
  }
  
  private async loadUserNames(chats: any[]) {
    if (!this.currentUser) return;
    
    const newUserNames: { [key: string]: string } = {};
    let namesUpdated = false;
    
    for (const chat of chats) {
      for (const participantId of chat.participants) {
        // Si ya tenemos el nombre o es el usuario actual, continuamos
        if (this.userNames[participantId] || participantId === this.currentUser.uid) {
          if (this.userNames[participantId]) {
            newUserNames[participantId] = this.userNames[participantId];
          }
          continue;
        }
        
        try {
          const userData = await this.registerService.getUserData(participantId);
          if (userData) {
            newUserNames[participantId] = `${userData.nombre} ${userData.apellido}`;
            namesUpdated = true;
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    }
    
    if (namesUpdated) {
      this.zone.run(() => {
        this.userNames = { ...this.userNames, ...newUserNames };
        this.cdr.detectChanges();
      });
    }
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones al destruir el componente
    if (this.chatsSubscription) {
      this.chatsSubscription.unsubscribe();
    }
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  navigateTo(chatId: string) {
    if (!chatId) {
      console.error('No chat ID provided');
      return;
    }
    this.router.navigate(['/menu/mensajes', chatId]);
  }

  getUserName(participants: string[]): string {
    if (!this.currentUser) return '';
    
    const otherUserId = participants.find(id => id !== this.currentUser.uid);
    if (!otherUserId) return 'Usuario';
    
    return this.userNames[otherUserId] || 'Cargando...';
  }
}
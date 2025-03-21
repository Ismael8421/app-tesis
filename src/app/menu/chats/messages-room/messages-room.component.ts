import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { Auth } from '@angular/fire/auth';
import { Observable, Subscription, interval, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecomendatioIconComponent } from '../../../UI/recomendatio-icon/recomendatio-icon.component';
import { IonAvatar, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { RegisterService } from '../../../register/data-access/register.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ThemeService } from '../../configs/settings/data-access/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-messages-room',
  templateUrl: './messages-room.component.html',
  styleUrls: ['./messages-room.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RecomendatioIconComponent, IonContent, IonList, IonItem, IonAvatar, IonLabel]
})
export class MessagesRoomComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private auth = inject(Auth);
  private router = inject(Router);
  private registerService = inject(RegisterService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private _themeService = inject(ThemeService);
  
  private chatsSubscription?: Subscription;
  private authStateSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  private searchSubscription?: Subscription;
  
  // Intervalo de refresco en milisegundos (15 segundos)
  private REFRESH_INTERVAL = 15000;

  // Lista directa de chats
  chats: any[] = [];
  filteredChats: any[] = [];
  
  currentUser: any = null;
  userNames: { [key: string]: string } = {};
  
  // Variables para búsqueda
  searchTerm: string = '';
  isSearching: boolean = false;
  private searchSubject = new Subject<string>();
  
  // Variable para modo oscuro
  isDarkMode: boolean = false;

  constructor() {
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
    
    // Configurar el debounce para la búsqueda
    this.setupSearchDebounce();
    
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

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  // Configura el debounce para la búsqueda
  private setupSearchDebounce() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Esperar 300ms después de la última entrada
      distinctUntilChanged() // Solo realizar la búsqueda si el término ha cambiado
    ).subscribe(term => {
      this.performSearch(term);
    });
  }
  
  // Método llamado cuando el usuario escribe en el campo de búsqueda
  onSearchInput() {
    this.searchSubject.next(this.searchTerm);
  }

  // Realizar la búsqueda
  private performSearch(term: string) {
    this.zone.run(() => {
      this.isSearching = term.length > 0;
      
      if (!term.trim()) {
        // Si no hay término de búsqueda, mostrar todos los chats
        this.filteredChats = [...this.chats];
      } else {
        const lowerTerm = term.toLowerCase();
        
        // Filtrar los chats según el nombre del usuario
        this.filteredChats = this.chats.filter(chat => {
          // Encontrar el ID del otro participante
          const otherUserId = chat.participants.find((id: string) => id !== this.currentUser.uid);
          
          if (!otherUserId) return false;
          
          // Obtener el nombre del otro usuario
          const userName = this.userNames[otherUserId];
          
          // Si aún no tenemos el nombre, siempre incluirlo en los resultados
          if (!userName) return true;
          
          // Verificar si el nombre contiene el término de búsqueda
          return userName.toLowerCase().includes(lowerTerm);
        });
      }
      
      this.cdr.detectChanges();
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
      this.filteredChats = [];
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
              
              // Inicializar los chats filtrados si es la primera carga
              if (this.filteredChats.length === 0 && !this.searchTerm) {
                this.filteredChats = [...this.chats];
              } else {
                // Si ya hay una búsqueda activa, actualizar los resultados
                this.performSearch(this.searchTerm);
              }
              
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
            newUserNames[participantId] = userData.nombreUsuario || 'Usuario';
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
        
        // Volver a ejecutar la búsqueda si hay una activa
        if (this.searchTerm) {
          this.performSearch(this.searchTerm);
        }
        
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
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
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
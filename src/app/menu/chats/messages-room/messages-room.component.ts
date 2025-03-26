import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { ChatStorageService } from '../data-access/chat-storage.service';
import { NetworkService } from '../data-access/network.service';
import { Auth } from '@angular/fire/auth';
import { Observable, Subscription, interval, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecomendatioIconComponent } from '../../../UI/recomendatio-icon/recomendatio-icon.component';
import { ActionSheetButton, AlertButton, IonActionSheet, IonAlert, IonAvatar, IonContent, IonIcon, IonItem, IonLabel, IonList, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, closeOutline, ellipsisVertical, cloudOffline } from 'ionicons/icons';
import { RegisterService } from '../../../register/data-access/register.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ThemeService } from '../../configs/settings/data-access/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-messages-room',
  templateUrl: './messages-room.component.html',
  styleUrls: ['./messages-room.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RecomendatioIconComponent, IonContent, IonList, IonItem, 
    IonAvatar, IonLabel, IonRefresher, IonRefresherContent, IonSpinner, IonIcon, IonActionSheet, IonAlert]
})
export class MessagesRoomComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private storageService = inject(ChatStorageService);
  private networkService = inject(NetworkService);
  private auth = inject(Auth);
  private router = inject(Router);
  private registerService = inject(RegisterService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private _themeService = inject(ThemeService);
  
  // Suscripciones
  private chatsSubscription?: Subscription;
  private authStateSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private networkSubscription?: Subscription;
  
  // Intervalo de refresco en milisegundos (15 segundos)
  private REFRESH_INTERVAL = 15000;

  // Variables para acción de long press y eliminar chat
  selectedChat: any = null;
  showActionSheet = false;
  showDeleteConfirm = false;
  longPressTimeout: any = null;
  longPressDelay = 500; // tiempo en ms para considerar un long press

  // Lista directa de chats
  chats: any[] = [];
  filteredChats: any[] = [];
  
  currentUser: any = null;
  userNames: { [key: string]: string } = {};
  
  // Variables para búsqueda
  searchTerm: string = '';
  isSearching: boolean = false;
  private searchSubject = new Subject<string>();
  
  // Variables para UI
  isOnline: boolean = true;
  isLoading: boolean = true;
  isDarkMode: boolean = false;

  actionSheetButtons: ActionSheetButton[] = [
    {
      text: 'Eliminar conversación',
      role: 'destructive',
      icon: 'trash-outline',
      handler: () => this.confirmDeleteChat()
    },
    {
      text: 'Cancelar',
      role: 'cancel',
      icon: 'close-outline'
    }
  ];
  
  alertButtons: AlertButton[] = [
    {
      text: 'Cancelar',
      role: 'cancel',
      handler: () => this.cancelDelete()
    },
    {
      text: 'Eliminar',
      role: 'destructive',
      handler: () => this.deleteSelectedChat()
    }
  ];

  constructor() {
    // Registrar iconos de Ionic
    addIcons({
      'trash-outline': trashOutline,
      'close-outline': closeOutline,
      'ellipsis-vertical': ellipsisVertical,
      'cloud-offline': cloudOffline
    });
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
    
    // Suscribirse a cambios en la conectividad
    this.networkSubscription = this.networkService.isOnline$.subscribe(isOnline => {
      this.zone.run(() => {
        this.isOnline = isOnline;
        
        // Si recuperamos la conectividad, actualizar datos
        if (isOnline) {
          this.chatService.forceRefreshChats();
        }
        
        this.cdr.detectChanges();
      });
    });
    
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
      
      // Cargar nombres de usuario desde la caché
      this.loadCachedUserNames();
    });
  }
  
  // Cargar nombres de usuario desde la caché
  private async loadCachedUserNames() {
    if (!this.currentUser) return;
    
    try {
      const cachedNames = await this.storageService.getUserNames();
      
      if (Object.keys(cachedNames).length > 0) {
        this.zone.run(() => {
          this.userNames = cachedNames;
          this.cdr.detectChanges();
        });
      }
    } catch (error) {
      console.error('Error cargando nombres de usuario en caché:', error);
    }
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  // Configura el debounce para la búsqueda
  private setupSearchDebounce() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
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
        this.filteredChats = [...this.chats];
      } else {
        const lowerTerm = term.toLowerCase();
        
        this.filteredChats = this.chats.filter(chat => {
          const otherUserId = chat.participants.find((id: string) => id !== this.currentUser.uid);
          
          if (!otherUserId) return false;
          
          const userName = this.userNames[otherUserId];
          
          if (!userName) return true;
          
          return userName.toLowerCase().includes(lowerTerm);
        });
      }
      
      this.cdr.detectChanges();
    });
  }

  private setupPeriodicRefresh() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    
    if (!this.currentUser) return;
    
    this.refreshSubscription = interval(this.REFRESH_INTERVAL).subscribe(() => {
      if (this.isOnline) {
        this.chatService.forceRefreshChats();
      }
    });
  }

  private setupChatsSubscription() {
    if (this.chatsSubscription) {
      this.chatsSubscription.unsubscribe();
    }
    
    if (!this.currentUser) {
      this.chats = [];
      this.filteredChats = [];
      this.isLoading = false;
      return;
    }
    
    this.isLoading = true;
    
    this.chatsSubscription = this.chatService.getUserChatsRealtime(this.currentUser.uid)
      .subscribe({
        next: (chats) => {
          this.zone.run(() => {
            this.isLoading = false;
            
            this.chats = chats;
            
            if (this.filteredChats.length === 0 && !this.searchTerm) {
              this.filteredChats = [...this.chats];
            } else {
              this.performSearch(this.searchTerm);
            }
            
            this.cdr.detectChanges();
            this.appRef.tick();
            
            this.loadUserNames(chats);
          });
        },
        error: (error) => {
          console.error('Error in chats subscription:', error);
          this.isLoading = false;
        }
      });
  }
  
  private async loadUserNames(chats: any[]) {
    if (!this.currentUser) return;
    
    const newUserNames: { [key: string]: string } = {};
    let namesUpdated = false;
    
    for (const chat of chats) {
      for (const participantId of chat.participants) {
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
        
        this.storageService.saveUserNames(this.userNames);
        
        if (this.searchTerm) {
          this.performSearch(this.searchTerm);
        }
        
        this.cdr.detectChanges();
      });
    }
  }

  ngOnDestroy() {
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
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
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
  
  // Método para el pull-to-refresh
  handleRefresh(event: any) {
    if (this.isOnline && this.currentUser) {
      this.chatService.forceRefreshChats();
      
      setTimeout(() => {
        event.target.complete();
      }, 1000);
    } else {
      event.target.complete();
    }
  }

  onChatItemTouchStart(event: TouchEvent, chat: any) {
    if (!this.isOnline) return;
    
    this.longPressTimeout = setTimeout(() => {
      this.handleLongPress(chat);
    }, this.longPressDelay);
  }

  onChatItemTouchEnd(event: TouchEvent) {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
  }

  handleLongPress(chat: any) {
    this.zone.run(() => {
      this.selectedChat = chat;
      this.showActionSheet = true;
      this.cdr.detectChanges();
    });
  }

  closeActionSheet() {
    this.showActionSheet = false;
    this.cdr.detectChanges();
  }
  
  confirmDeleteChat() {
    this.showActionSheet = false;
    this.showDeleteConfirm = true;
    this.cdr.detectChanges();
  }
  
  cancelDelete() {
    this.showDeleteConfirm = false;
    this.selectedChat = null;
    this.cdr.detectChanges();
  }

  async deleteSelectedChat() {
    if (!this.selectedChat || !this.currentUser) {
      this.cancelDelete();
      return;
    }
    
    try {
      await this.chatService.deleteChat(this.selectedChat.id, this.currentUser.uid);
      
      this.showDeleteSuccess();
    } catch (error) {
      console.error('Error eliminando chat:', error);
      this.showDeleteError();
    } finally {
      this.showDeleteConfirm = false;
      this.selectedChat = null;
      this.cdr.detectChanges();
    }
  }

  private showDeleteSuccess() {
    console.log('Chat eliminado con éxito');
    // Opcional: Mostrar un Toast con éxito
  }
  
  private showDeleteError() {
    console.log('Error al eliminar el chat');
    // Opcional: Mostrar un Toast con error
  }
}
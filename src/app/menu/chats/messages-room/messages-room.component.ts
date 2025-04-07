import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { ChatService } from '../data-access/chat.service';
import { ChatStorageService } from '../data-access/chat-storage.service';
import { NetworkService } from '../data-access/network.service';
import { Auth } from '@angular/fire/auth';
import { Observable, Subscription, interval, Subject, of } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecomendatioIconComponent } from '../../../UI/recomendatio-icon/recomendatio-icon.component';
import { ActionSheetButton, AlertButton, IonActionSheet, IonAlert, IonAvatar, IonContent, IonIcon, IonItem, IonLabel, IonList, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, closeOutline, ellipsisVertical, cloudOffline } from 'ionicons/icons';
import { RegisterService } from '../../../register/data-access/register.service';
import { catchError, debounceTime, distinctUntilChanged, filter } from 'rxjs/operators';
import { ThemeService } from '../../configs/settings/data-access/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserProfileService } from '../../../core/services/user-profile.service';

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
  private userProfileService = inject(UserProfileService);

  // Suscripciones
  private subscriptions: Subscription[] = [];
  private chatsSubscription?: Subscription;
  private authStateSubscription?: Subscription;
  private refreshSubscription?: Subscription;
  private searchSubscription?: Subscription;
  private networkSubscription?: Subscription;

  private profileImageCache = new Map<string, string>();

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

    // Suscribirse a eventos de eliminación de chat
    this.chatService.chatDeletedEvent$
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        if (event.userId === this.currentUser?.uid) {
          // Actualizar las listas locales inmediatamente
          this.zone.run(() => {
            this.chats = this.chats.filter(chat => chat.id !== event.chatId);
            this.filteredChats = this.filteredChats.filter(chat => chat.id !== event.chatId);
            this.cdr.detectChanges();
          });
        }
      });
  }

  ngOnInit() {
    // Inicializar el estado del tema
    this.updateDarkModeStatus();

    // Configurar el debounce para la búsqueda
    this.setupSearchDebounce();

    // Suscribirse a eventos de eliminación de chat
    this.subscriptions.push(
      this.chatService.chatDeletedEvent$
        .subscribe(event => {
          if (event.userId === this.currentUser?.uid) {
            // Actualizar las listas locales inmediatamente
            this.zone.run(() => {
              this.chats = this.chats.filter(chat => chat.id !== event.chatId);
              this.filteredChats = this.filteredChats.filter(chat => chat.id !== event.chatId);
              this.cdr.detectChanges();
            });
          }
        })
    );

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

    // Reducir la frecuencia de actualización a 30 segundos para reducir la carga
    const REFRESH_INTERVAL = 30000; // 30 segundos

    this.refreshSubscription = interval(REFRESH_INTERVAL)
      .pipe(
        // Solo hacer el refresco si hay conexión y el usuario está autenticado
        filter(() => this.isOnline && !!this.auth.currentUser)
      )
      .subscribe(() => {
        console.log('Ejecutando refresco periódico de chats');
        try {
          this.chatService.forceRefreshChats();
        } catch (error) {
          console.error('Error en refresco periódico:', error);
          // Si hay un error, no interrumpir el flujo de la aplicación
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
      .pipe(
        // Añadir manejo de errores dentro del pipe
        catchError(error => {
          console.error('Error obteniendo chats:', error);
          this.isLoading = false;
          return of([]); // Devolver array vacío en caso de error
        })
      )
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

            // Cargar nombres de usuario de forma más eficiente
            this.loadUserNames(chats);
          });
        },
        error: (error) => {
          console.error('Error en suscripción de chats:', error);
          this.zone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges();
          });
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
    // Desuscribirse de todas las suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

    // Navegar al chat
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
      // Guardar referencia al chat que va a ser eliminado
      const chatToDelete = { ...this.selectedChat };

      // Ocultar la alerta de confirmación
      this.showDeleteConfirm = false;
      this.selectedChat = null;

      // Actualizar UI primero (optimista)
      this.zone.run(() => {
        this.chats = this.chats.filter(chat => chat.id !== chatToDelete.id);
        this.filteredChats = this.filteredChats.filter(chat => chat.id !== chatToDelete.id);
        this.cdr.detectChanges();

        // Mostrar mensaje de éxito inmediatamente
        this.presentToast('Eliminando conversación...');
      });

      // Luego eliminar en el backend
      await this.chatService.deleteChat(chatToDelete.id, this.currentUser.uid);

      // Mostrar confirmación final
      this.presentToast('Conversación eliminada correctamente');

    } catch (error) {
      console.error('Error eliminando chat:', error);
      this.presentToast('Error al eliminar la conversación', 'danger');

      // Recargar la lista de chats en caso de error
      this.setupChatsSubscription();
    }
  }

  private showDeleteSuccess() {
    console.log('Chat eliminado con éxito');

    // Si estás usando Ionic, puedes mostrar un Toast con un mensaje de éxito
    // Ejemplo con Ionic Toast Controller:
    this.presentToast('Conversación eliminada correctamente');
  }

  private showDeleteError() {
    console.log('Error al eliminar el chat');
    // Opcional: Mostrar un Toast con error
  }

  async presentToast(message: string, color: string = 'success') {
    try {
      const { ToastController } = await import('@ionic/angular/standalone');
      const toastController = new ToastController();

      const toast = await toastController.create({
        message: message,
        duration: 2000,
        position: 'bottom',
        color: color,
        cssClass: 'toast-custom-class'
      });

      await toast.present();
    } catch (error) {
      console.log('Toast no disponible, mostrando mensaje en consola:', message);
    }
  }

  getProfileImageUrl(userId: string): string {
    // Si ya tenemos la URL en caché, devolverla
    if (this.profileImageCache.has(userId)) {
      return this.profileImageCache.get(userId) || 'icons/logo_tesis.png';
    }

    // Si no, solicitar la URL y guardarla en caché cuando llegue
    this.userProfileService.getProfileImageUrl(userId).subscribe(url => {
      if (url) {
        this.zone.run(() => {
          this.profileImageCache.set(userId, url);
          this.cdr.detectChanges();
        });
      }
    });

    // Mientras tanto, devolver la imagen por defecto
    return 'icons/logo_tesis.png';
  }

  // Método para manejar errores de carga de imagen
  handleImageError(event: Event, userId: string): void {
    if (event.target) {
      (event.target as HTMLImageElement).src = 'icons/logo_tesis.png';
    }

    // Marcar en caché que esta imagen falló para no volver a intentar cargarla
    this.profileImageCache.set(userId, 'icons/logo_tesis.png');
  }

  getUserParticipantId(participants: string[]): string {
    if (!this.currentUser) return participants[0] || '';

    // Encontrar el ID del otro participante (que no sea el usuario actual)
    const otherUserId = participants.find(userId => userId !== this.currentUser?.uid);

    return otherUserId || '';
  }

  // Método para verificar correctamente si un chat tiene mensajes no leídos
  hasUnreadMessages(chat: any): boolean {
    if (!this.currentUser || !chat) {
      return false;
    }

    // Si no hay propiedad unreadMessages, devolver false
    if (!chat.unreadMessages) {
      return false;
    }

    // Comprobar explícitamente si el valor es true (no solo si existe)
    return chat.unreadMessages[this.currentUser.uid] === true;
  }
}
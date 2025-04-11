import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem, IonAvatar, IonLabel, IonButton, IonSegment, IonSegmentButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent, IonAlert, ToastController } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { LikedProfilesService } from '../search/data-access/iked-profiles.service';
import { RejectedProfilesService } from '../search/data-access/rejected-profiles.service';
import { ChatService } from '../chats/data-access/chat.service';
import { MessagesIconComponent } from '../../UI/messages-icon/messages-icon.component';
import { CheckIconComponent } from '../../UI/check-icon/check-icon.component';
import { addIcons } from 'ionicons';
import { refreshOutline, arrowUndoOutline, chatbubbleEllipsesOutline, heartOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { StarIconComponent } from '../../UI/star-icon/star-icon.component';
import { UserProfileService } from '../../core/services/user-profile.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButton,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonAlert,
    MessagesIconComponent,
    StarIconComponent,
    CheckIconComponent
  ],
  templateUrl: './favoritos.component.html',
  styleUrls: ['./favoritos.component.scss'],
})
export class FavoritosComponent implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private likedProfilesService = inject(LikedProfilesService);
  private rejectedProfilesService = inject(RejectedProfilesService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private userProfileService = inject(UserProfileService);
  private cdr = inject(ChangeDetectorRef);

  private profileImageCache = new Map<string, { url: string | null, loading: boolean }>();

  selectedSegment: 'likes' | 'rejected' = 'likes';
  likedProfiles: any[] = [];
  rejectedProfiles: any[] = [];
  isLikedLoading = true;
  isRejectedLoading = true;
  showConfirmation = false;
  profileToUnlike: any = null;
  
  // Definir los botones para la alerta
  alertButtons = [
    {
      text: 'Cancelar',
      role: 'cancel',
      handler: () => {
        this.showConfirmation = false;
      }
    },
    {
      text: 'Confirmar',
      handler: () => {
        this.unlikeProfile();
      }
    }
  ];

  constructor() {
    addIcons({ 
      refreshOutline, 
      arrowUndoOutline, 
      chatbubbleEllipsesOutline,
      heartOutline,
      checkmarkCircleOutline
    });
  }

  ngOnInit() {
    this.loadProfiles();
  }

  segmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
    
    // Forzar la actualización de la vista al cambiar de segmento
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 50);
  }

  async loadProfiles() {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;
    
    // Cargar perfiles con like
    this.isLikedLoading = true;
    this.likedProfilesService.getLikedProfiles().subscribe(async (likedIds) => {
      this.likedProfiles = [];
      
      if (likedIds.length === 0) {
        this.isLikedLoading = false;
        return;
      }
      
      // Array para acumular perfiles cargados
      const loadedProfiles = [];
      
      // Cargar los detalles de cada perfil
      for (const uid of likedIds) {
        try {
          const userDoc = await getDoc(doc(this.firestore, 'usuarios', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Obtener información adicional si está disponible
            let carreraData: any = {};
            
            try {
              // Intentar obtener datos específicos de la carrera
              if (userData['carrera']) {
                const carreraDoc = await getDoc(doc(this.firestore, userData['carrera'], uid));
                if (carreraDoc.exists()) {
                  carreraData = carreraDoc.data();
                }
              }
            } catch (error) {
              console.error('Error al obtener datos de carrera:', error);
            }
            
            const profile = {
              uid,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userData['carrera'] || '',
              anioLectivo: userData['anioLectivo'] || '',
              paralelo: userData['paralelo'] || '',
              ...carreraData
            };
            
            loadedProfiles.push(profile);
          }
        } catch (error) {
          console.error('Error al cargar perfil con like:', error);
        }
      }
      
      // Actualizar la lista de perfiles
      this.likedProfiles = loadedProfiles;
      
      // Precargar imágenes
      this.preloadProfileImages(this.likedProfiles);
      
      // Marcar carga como completa
      this.isLikedLoading = false;
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
    });
    
    // Cargar perfiles rechazados con la misma lógica mejorada
    this.isRejectedLoading = true;
    this.rejectedProfilesService.getRejectedProfiles().subscribe(async (rejectedIds) => {
      this.rejectedProfiles = [];
      
      if (rejectedIds.length === 0) {
        this.isRejectedLoading = false;
        return;
      }
      
      const loadedProfiles = [];
      
      // Cargar los detalles de cada perfil
      for (const uid of rejectedIds) {
        try {
          const userDoc = await getDoc(doc(this.firestore, 'usuarios', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Obtener información adicional si está disponible
            let carreraData: any = {};
            
            try {
              // Intentar obtener datos específicos de la carrera
              if (userData['carrera']) {
                const carreraDoc = await getDoc(doc(this.firestore, userData['carrera'], uid));
                if (carreraDoc.exists()) {
                  carreraData = carreraDoc.data();
                }
              }
            } catch (error) {
              console.error('Error al obtener datos de carrera:', error);
            }
            
            const profile = {
              uid,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userData['carrera'] || '',
              anioLectivo: userData['anioLectivo'] || '',
              paralelo: userData['paralelo'] || '',
              ...carreraData
            };
            
            loadedProfiles.push(profile);
          }
        } catch (error) {
          console.error('Error al cargar perfil rechazado:', error);
        }
      }
      
      // Actualizar la lista de perfiles
      this.rejectedProfiles = loadedProfiles;
      
      // Precargar imágenes
      this.preloadProfileImages(this.rejectedProfiles);
      
      // Marcar carga como completa
      this.isRejectedLoading = false;
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
    });
  }

  handleRefresh(event: any) {
    setTimeout(() => {
      this.loadProfiles();
      event.target.complete();
    }, 1000);
  }

  async startChat(otherUserId: string, otherUserName: string) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('No user logged in');
      return;
    }

    try {
      const chatId = await this.chatService.startChat(currentUser.uid, otherUserId);
      if (chatId) {
        this.router.navigate(['/menu/mensajes', chatId]);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      this.presentToast('Error al iniciar chat', 'danger');
    }
  }

  confirmRemoveLike(profile: any) {
    this.profileToUnlike = profile;
    this.showConfirmation = true;
  }

  async unlikeProfile() {
    if (!this.profileToUnlike) return;
    
    try {
      await this.likedProfilesService.unlikeProfile(this.profileToUnlike.uid);
      // Actualizar la lista localmente
      this.likedProfiles = this.likedProfiles.filter(p => p.uid !== this.profileToUnlike.uid);
      this.presentToast('Perfil eliminado de guardados', 'success');
    } catch (error) {
      console.error('Error al quitar like:', error);
      this.presentToast('Error al eliminar de guardados', 'danger');
    }
    
    this.profileToUnlike = null;
  }

  async unrejectProfile(profile: any) {
    try {
      await this.rejectedProfilesService.unrejectProfile(profile.uid);
      // Actualizar la lista localmente
      this.rejectedProfiles = this.rejectedProfiles.filter(p => p.uid !== profile.uid);
      this.presentToast('Perfil devuelto a recomendados', 'success');
    } catch (error) {
      console.error('Error al quitar rechazo:', error);
      this.presentToast('Error al devolver perfil a recomendados', 'danger');
    }
  }

  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      buttons: [
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ]
    });
  
    await toast.present();
  }

  getProfileImageUrl(userId: string): string {
    // Verificar si ya tenemos esta imagen en caché
    const cachedData = this.profileImageCache.get(userId);
    
    if (cachedData) {
      // Si tenemos un resultado (exitoso o fallido), devolverlo
      if (cachedData.url) {
        return cachedData.url;
      }
      // Si está cargando, devolver la imagen por defecto
      if (cachedData.loading) {
        return 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg';
      }
    }
    
    // Si no está en caché, iniciar la carga
    this.profileImageCache.set(userId, { url: null, loading: true });
    
    this.userProfileService.getProfileImageUrl(userId).subscribe({
      next: (url) => {
        if (url) {
          // Actualizar caché con la URL
          this.profileImageCache.set(userId, { url, loading: false });
          // Forzar detección de cambios
          this.cdr.detectChanges();
        } else {
          // Si no hay URL, usar la imagen predeterminada
          this.profileImageCache.set(userId, { 
            url: 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg', 
            loading: false 
          });
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error obteniendo imagen de perfil:', err);
        this.profileImageCache.set(userId, { 
          url: 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg', 
          loading: false 
        });
        this.cdr.detectChanges();
      }
    });
    
    // Mientras tanto, devolver la imagen por defecto
    return 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg';
  }

  handleImageError(event: Event, userId?: string) {
    if (event.target) {
      (event.target as HTMLImageElement).src = 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg';
    }
    
    // Si tenemos el userId, actualizar el caché
    if (userId) {
      this.profileImageCache.set(userId, { 
        url: 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg', 
        loading: false 
      });
    }
  }

  private preloadProfileImages(profiles: any[]) {
    if (!profiles || profiles.length === 0) return;
    
    // Precargar imágenes para todos los perfiles
    for (const profile of profiles) {
      if (profile.uid) {
        // Esto iniciará la carga y guardará en caché
        this.getProfileImageUrl(profile.uid);
      }
    }
  }
}
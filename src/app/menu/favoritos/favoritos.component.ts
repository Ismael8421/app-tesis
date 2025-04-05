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
            
            this.likedProfiles.push({
              uid,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userData['carrera'] || '',
              anioLectivo: userData['anioLectivo'] || '',
              paralelo: userData['paralelo'] || '',
              ...carreraData
            });
          }
        } catch (error) {
          console.error('Error al cargar perfil con like:', error);
        }
      }
      
      this.isLikedLoading = false;
    });
    
    // Cargar perfiles rechazados
    this.isRejectedLoading = true;
    this.rejectedProfilesService.getRejectedProfiles().subscribe(async (rejectedIds) => {
      this.rejectedProfiles = [];
      
      if (rejectedIds.length === 0) {
        this.isRejectedLoading = false;
        return;
      }
      
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
            
            this.rejectedProfiles.push({
              uid,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userData['carrera'] || '',
              anioLectivo: userData['anioLectivo'] || '',
              paralelo: userData['paralelo'] || '',
              ...carreraData
            });
          }
        } catch (error) {
          console.error('Error al cargar perfil rechazado:', error);
        }
      }
      
      this.isRejectedLoading = false;
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
      this.presentToast('Perfil eliminado de favoritos', 'success');
    } catch (error) {
      console.error('Error al quitar like:', error);
      this.presentToast('Error al eliminar de favoritos', 'danger');
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
}
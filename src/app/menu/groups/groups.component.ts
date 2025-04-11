import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonAvatar,
  IonLabel,
  IonIcon,
  IonButton,
  AlertController,
  ToastController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { ProfileVisibilityService } from '../search/data-access/profile-visibility.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ProfileImageService } from '../configs/profile/profile-image.service';
import { RegisterService } from '../../register/data-access/register.service';

interface GroupMember {
  uid: string;
  nombreUsuario: string;
  nombre?: string;
  apellido?: string;
  carrera?: string;
  anioLectivo?: string;
  paralelo?: string;
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonAvatar,
    IonLabel,
    IonIcon,
    IonButton
  ],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss'
})
export class GroupsComponent implements OnInit {
  private _auth = inject(Auth);
  private _router = inject(Router);
  private _firestore = inject(Firestore);
  private _registerService = inject(RegisterService);
  private _profileImageService = inject(ProfileImageService);
  private _profileVisibilityService = inject(ProfileVisibilityService);
  private _alertController = inject(AlertController);
  private _toastController = inject(ToastController);
  private _actionSheetController = inject(ActionSheetController);

  loading = true;
  isInGroup = false;
  groupMembers: string[] = [];
  groupMembersData: GroupMember[] = [];
  remainingSlots: number[] = [];
  profileImageUrl: string | null = null;
  userName: string = 'Usuario';

  constructor() {
    // Suscribirse al estado del perfil para detectar cambios en el grupo
    this._profileVisibilityService.getProfileStatus()
      .pipe(takeUntilDestroyed())
      .subscribe(status => {
        this.isInGroup = status.visibility === 'visible_in_group';
        this.groupMembers = status.groupMembers || [];
        this.loadGroupMembersData();
      });
  }

  async ngOnInit() {
    try {
      const currentUser = this._auth.currentUser;
      if (currentUser) {
        // Cargar imagen y nombre del usuario actual
        this.profileImageUrl = await this._profileImageService.getProfileImage(currentUser.uid);
        const userData = await this._registerService.getUserData(currentUser.uid);
        if (userData) {
          this.userName = userData.nombreUsuario || 'Usuario';
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    } finally {
      this.loading = false;
    }
  }

  handleImageError() {
    this.profileImageUrl = 'icons/logo_tesis.png';
  }

  navigateToRecommended() {
    this._router.navigateByUrl('/menu/recomendados');
  }

  async handleRefresh(event?: any) {
    try {
      this.loading = true;
      // Recargar datos del grupo
      await this.loadGroupMembersData();
    } catch (error) {
      console.error('Error al actualizar datos del grupo:', error);
    } finally {
      if (event && event.target) {
        event.target.complete();
      }
      this.loading = false;
    }
  }

  async loadGroupMembersData() {
    try {
      this.groupMembersData = [];
      
      // Si no está en un grupo o no hay miembros, mostrar los slots vacíos
      if (!this.isInGroup || this.groupMembers.length === 0) {
        this.remainingSlots = Array(5).fill(0);
        this.loading = false;
        return;
      }

      // Cargar datos de cada miembro del grupo
      const membersPromises = this.groupMembers.map(async (memberId) => {
        try {
          // Obtener datos del usuario desde Firestore
          const userDoc = await getDoc(doc(this._firestore, 'usuarios', memberId));
          
          if (!userDoc.exists()) {
            console.log(`No se encontraron datos para el miembro ${memberId}`);
            return null;
          }
          
          const userData = userDoc.data();
          return {
            uid: memberId,
            nombreUsuario: userData['nombreUsuario'] || 'Usuario',
            nombre: userData['nombre'] || '',
            apellido: userData['apellido'] || '',
            carrera: userData['carrera'] || '',
            anioLectivo: userData['anioLectivo'] || '',
            paralelo: userData['paralelo'] || ''
          } as GroupMember;
        } catch (error) {
          console.error(`Error al cargar datos del miembro ${memberId}:`, error);
          return null;
        }
      });

      const membersData = await Promise.all(membersPromises);
      
      // Filtrar los miembros nulos (error al cargar)
      this.groupMembersData = membersData.filter(member => member !== null) as GroupMember[];
      
      // Calcular espacios restantes
      const totalMembers = this.groupMembersData.length;
      this.remainingSlots = Array(Math.max(0, 5 - totalMembers)).fill(0);
      
    } catch (error) {
      console.error('Error al cargar datos de los miembros del grupo:', error);
    } finally {
      this.loading = false;
    }
  }

  async openMemberOptions(member: GroupMember) {
    const actionSheet = await this._actionSheetController.create({
      header: member.nombreUsuario,
      buttons: [
        {
          text: 'Ver perfil',
          icon: 'person-outline',
          handler: () => {
            console.log('Ver perfil de:', member.uid);
            // Implementar navegación al perfil
          }
        },
        {
          text: 'Enviar mensaje',
          icon: 'chatbubble-outline',
          handler: () => {
            this.startChat(member.uid, member.nombreUsuario);
          }
        },
        {
          text: 'Eliminar del grupo',
          icon: 'person-remove-outline',
          role: 'destructive',
          handler: () => {
            this.confirmRemoveMember(member);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async startChat(otherUserId: string, otherUserName: string) {
    // Aquí implementarías la lógica para iniciar un chat con el miembro
    console.log('Iniciar chat con:', otherUserId);
    // Por ejemplo:
    // const chatId = await this.chatService.startChat(currentUser.uid, otherUserId);
    // this._router.navigate(['/menu/mensajes', chatId]);
  }

  async confirmRemoveMember(member: GroupMember) {
    const alert = await this._alertController.create({
      header: 'Eliminar miembro',
      message: `¿Estás seguro de que quieres eliminar a ${member.nombreUsuario} del grupo?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              // Implementar la lógica para eliminar al miembro
              await this._profileVisibilityService.removeMemberFromGroup(member.uid);
              
              // Actualizar la lista
              await this.loadGroupMembersData();
              
              const toast = await this._toastController.create({
                message: `${member.nombreUsuario} ha sido eliminado del grupo`,
                duration: 2000,
                position: 'bottom',
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Error al eliminar miembro:', error);
              const toast = await this._toastController.create({
                message: 'Error al eliminar miembro del grupo',
                duration: 2000,
                position: 'bottom',
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmLeaveGroup() {
    const alert = await this._alertController.create({
      header: 'Abandonar grupo',
      message: '¿Estás seguro de que quieres abandonar tu grupo actual?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Abandonar',
          role: 'destructive',
          handler: async () => {
            try {
              await this._profileVisibilityService.leaveGroup();
              const toast = await this._toastController.create({
                message: 'Has abandonado el grupo',
                duration: 2000,
                position: 'bottom',
                color: 'primary'
              });
              await toast.present();
            } catch (error) {
              console.error('Error al abandonar grupo:', error);
              const toast = await this._toastController.create({
                message: 'Error al abandonar el grupo',
                duration: 2000,
                position: 'bottom',
                color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }
}
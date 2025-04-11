import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
  ActionSheetController,
  IonSegment,
  IonSegmentButton,
  IonBadge,
  IonList
} from '@ionic/angular/standalone';
import { ProfileVisibilityService } from '../search/data-access/profile-visibility.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ProfileImageService } from '../configs/profile/profile-image.service';
import { RegisterService } from '../../register/data-access/register.service';
import { GroupInvitationsService, GroupInvitation } from './data-access/group-invitations.service';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface GroupMember {
  uid: string;
  nombreUsuario: string;
  nombre?: string;
  apellido?: string;
  carrera?: string;
  anioLectivo?: string;
  paralelo?: string;
  profileImageUrl?: string;
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    IonSegment,
    IonSegmentButton,
    IonBadge,
    IonList
  ],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.scss'
})
export class GroupsComponent implements OnInit, OnDestroy {
  private _auth = inject(Auth);
  private _router = inject(Router);
  private _firestore = inject(Firestore);
  private _registerService = inject(RegisterService);
  private _profileImageService = inject(ProfileImageService);
  private _profileVisibilityService = inject(ProfileVisibilityService);
  private _alertController = inject(AlertController);
  private _toastController = inject(ToastController);
  private _actionSheetController = inject(ActionSheetController);
  private _groupInvitationsService = inject(GroupInvitationsService);

  loading = true;
  isInGroup = false;
  groupMembers: string[] = [];
  pendingInvitations: string[] = [];
  groupMembersData: GroupMember[] = [];
  remainingSlots: number[] = [];
  profileImageUrl: string | null = null;
  userName: string = 'Usuario';

  // Invitaciones pendientes recibidas
  pendingInvitationsReceived: GroupInvitation[] = [];

  // Invitaciones pendientes enviadas por el usuario
  pendingGroupInvitations: GroupInvitation[] = [];

  // Controla qué tab está seleccionada (grupos o invitaciones)
  selectedTab: string = 'groups';

  // Suscripciones
  private invitationsReceivedSubscription: Subscription | null = null;
  private invitationsSentSubscription: Subscription | null = null;

  constructor() {
    // Suscribirse al estado del perfil para detectar cambios en el grupo
    this._profileVisibilityService.getProfileStatus()
      .pipe(takeUntilDestroyed())
      .subscribe(status => {
        this.isInGroup = status.visibility === 'visible_in_group';
        this.groupMembers = status.groupMembers || [];
        this.pendingInvitations = status.pendingInvitations || [];
        this.loadGroupMembersData();
      });

    // Suscribirse a las invitaciones recibidas
    this.invitationsReceivedSubscription = this._groupInvitationsService.getInvitationsReceived()
      .subscribe(invitations => {
        this.pendingInvitationsReceived = invitations;
      });

    // Suscribirse a las invitaciones enviadas
    this.invitationsSentSubscription = this._groupInvitationsService.getInvitationsSent()
      .subscribe(invitations => {
        this.pendingGroupInvitations = invitations;
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

    if (this.pendingInvitationsReceived.length > 0) {
      this.selectedTab = 'invitations';
    }
  }

  ngOnDestroy() {
    if (this.invitationsReceivedSubscription) {
      this.invitationsReceivedSubscription.unsubscribe();
    }

    if (this.invitationsSentSubscription) {
      this.invitationsSentSubscription.unsubscribe();
    }
  }

  handleImageError(event: any) {
    event.target.src = 'icons/logo_tesis.png';
  }

  navigateToRecommended() {
    this._router.navigateByUrl('/menu/recomendados');
  }

  viewInvitations() {
    this.selectedTab = 'invitations';
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
          // Primero obtenemos los datos básicos para saber la carrera
          const userDoc = await getDoc(doc(this._firestore, 'usuarios', memberId));

          if (!userDoc.exists()) {
            console.log(`No se encontraron datos para el miembro ${memberId}`);
            return null;
          }

          const userData = userDoc.data();
          const userCarrera = userData['carrera'];

          // Obtener la URL de la imagen de perfil
          let profileImageUrl = userData['profileImageUrl'] || null;

          if (!userCarrera) {
            console.log(`No se encontró carrera para el miembro ${memberId}`);
            return {
              uid: memberId,
              nombreUsuario: userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: 'Sin carrera',
              anioLectivo: '',
              paralelo: '',
              profileImageUrl: profileImageUrl
            } as GroupMember;
          }

          console.log(`Carrera del miembro ${memberId}: ${userCarrera}`);

          // Ahora buscamos los datos académicos en la colección correspondiente a su carrera
          const carreraDoc = await getDoc(doc(this._firestore, userCarrera, memberId));

          let anioLectivo = '';
          let paralelo = '';

          if (carreraDoc.exists()) {
            const carreraData = carreraDoc.data();
            anioLectivo = carreraData['anioLectivo'] || '';
            paralelo = carreraData['paralelo'] || '';
            const nombreUsuario = carreraData['nombreUsuario'] || '';
            console.log(`Datos académicos encontrados: Año=${anioLectivo}, Paralelo=${paralelo}, Nombre=${nombreUsuario}`);

            return {
              uid: memberId,
              nombreUsuario: nombreUsuario || userData['nombreUsuario'] || 'Usuario',
              nombre: userData['nombre'] || '',
              apellido: userData['apellido'] || '',
              carrera: userCarrera || 'Sin carrera',
              anioLectivo: anioLectivo,
              paralelo: paralelo,
              profileImageUrl: profileImageUrl
            } as GroupMember;
          } else {
            console.warn(`No se encontraron datos académicos en la colección ${userCarrera} para el miembro ${memberId}`);
          }

          return {
            uid: memberId,
            nombreUsuario: userData['nombreUsuario'] || 'Usuario',
            nombre: userData['nombre'] || '',
            apellido: userData['apellido'] || '',
            carrera: userCarrera || 'Sin carrera',
            anioLectivo: anioLectivo,
            paralelo: paralelo,
            profileImageUrl: profileImageUrl
          } as GroupMember;
        } catch (error) {
          console.error(`Error al cargar datos del miembro ${memberId}:`, error);
          return null;
        }
      });

      const membersData = await Promise.all(membersPromises);
      console.log('Datos finales de todos los miembros:', membersData);

      // Filtrar los miembros nulos (error al cargar)
      this.groupMembersData = membersData.filter(member => member !== null) as GroupMember[];
      console.log('Datos finales filtrados:', this.groupMembersData);

      // Calcular espacios restantes (considerando invitaciones pendientes)
      const totalMembers = this.groupMembersData.length;
      const totalPendingInvitations = this.pendingGroupInvitations.length;
      this.remainingSlots = Array(Math.max(0, 5 - totalMembers - totalPendingInvitations)).fill(0);

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

  async cancelPendingInvitation(invitation: GroupInvitation) {
    if (!invitation.id) return;

    const alert = await this._alertController.create({
      header: 'Cancelar invitación',
      message: `¿Estás seguro de que quieres cancelar la invitación enviada a ${invitation.toUserName || 'este usuario'}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: async () => {
            try {
              await this._groupInvitationsService.cancelInvitation(invitation.id!);
              await this._profileVisibilityService.removeInvitation(invitation.toUserId);

              const toast = await this._toastController.create({
                message: 'Invitación cancelada',
                duration: 2000,
                position: 'bottom',
                color: 'medium'
              });
              await toast.present();

              // Actualizar la lista
              await this.loadGroupMembersData();
            } catch (error) {
              console.error('Error al cancelar invitación:', error);
              const toast = await this._toastController.create({
                message: 'Error al cancelar la invitación',
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

  // Gestiona el cambio entre pestañas
  segmentChanged(event: any) {
    this.selectedTab = event.detail.value;
  }

  async acceptInvitation(invitation: GroupInvitation) {
    if (!invitation.id) return;
    
    const alert = await this._alertController.create({
      header: 'Aceptar invitación',
      message: `¿Quieres unirte al grupo de ${invitation.fromUserName}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Aceptar',
          handler: async () => {
            try {
              await this._groupInvitationsService.acceptInvitation(invitation.id!);
              this.presentToast(`Te has unido al grupo de ${invitation.fromUserName}`, 'success');
              
              // Cambiar a la pestaña de grupos
              this.selectedTab = 'groups';
              
              // Actualizar los datos
              await this.loadGroupMembersData();
            } catch (error) {
              console.error('Error al aceptar invitación:', error);
              this.presentToast('Error al aceptar la invitación', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async rejectInvitation(invitation: GroupInvitation) {
    if (!invitation.id) return;
    
    const alert = await this._alertController.create({
      header: 'Rechazar invitación',
      message: `¿Quieres rechazar la invitación de ${invitation.fromUserName}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Rechazar',
          handler: async () => {
            try {
              await this._groupInvitationsService.rejectInvitation(invitation.id!);
              this.presentToast('Invitación rechazada', 'medium');
            } catch (error) {
              console.error('Error al rechazar invitación:', error);
              this.presentToast('Error al rechazar la invitación', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async presentToast(message: string, color: string = 'success') {
    const toast = await this._toastController.create({
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
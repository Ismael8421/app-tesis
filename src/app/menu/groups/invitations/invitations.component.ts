import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonAvatar,
  IonSkeletonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { GroupInvitationsService, GroupInvitation } from '../data-access/group-invitations.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonAvatar,
    IonSkeletonText,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle
  ],
  templateUrl: './invitations.component.html',
  styleUrls: ['./invitations.component.scss'],
})
export class InvitationsComponent implements OnInit, OnDestroy {
  private invitationsService = inject(GroupInvitationsService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private router = inject(Router);
  
  receivedInvitations: GroupInvitation[] = [];
  sentInvitations: GroupInvitation[] = [];
  loading = true;
  
  private receivedSubscription: Subscription | null = null;
  private sentSubscription: Subscription | null = null;
  
  ngOnInit() {
    // Suscribirse a las invitaciones recibidas
    this.receivedSubscription = this.invitationsService.getInvitationsReceived().subscribe(
      invitations => {
        this.receivedInvitations = invitations;
        this.loading = false;
      }
    );
    
    // Suscribirse a las invitaciones enviadas
    this.sentSubscription = this.invitationsService.getInvitationsSent().subscribe(
      invitations => {
        this.sentInvitations = invitations;
        this.loading = false;
      }
    );
  }
  
  ngOnDestroy() {
    // Cancelar suscripciones para evitar memory leaks
    if (this.receivedSubscription) {
      this.receivedSubscription.unsubscribe();
    }
    
    if (this.sentSubscription) {
      this.sentSubscription.unsubscribe();
    }
  }
  
  handleImageError(event: any) {
    event.target.src = 'icons/logo_tesis.png';
  }
  
  async acceptInvitation(invitation: GroupInvitation) {
    if (!invitation.id) return;
    
    const alert = await this.alertController.create({
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
              await this.invitationsService.acceptInvitation(invitation.id!);
              this.presentToast(`Te has unido al grupo de ${invitation.fromUserName}`, 'success');
              
              // Redireccionar a la página de grupos
              setTimeout(() => {
                this.router.navigate(['/menu/grupos']);
              }, 1000);
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
    
    const alert = await this.alertController.create({
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
              await this.invitationsService.rejectInvitation(invitation.id!);
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
  
  async cancelInvitation(invitation: GroupInvitation) {
    if (!invitation.id) return;
    
    const alert = await this.alertController.create({
      header: 'Cancelar invitación',
      message: `¿Quieres cancelar la invitación enviada a ${invitation.toUserName || 'este usuario'}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: async () => {
            try {
              await this.invitationsService.cancelInvitation(invitation.id!);
              this.presentToast('Invitación cancelada', 'medium');
            } catch (error) {
              console.error('Error al cancelar invitación:', error);
              this.presentToast('Error al cancelar la invitación', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
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
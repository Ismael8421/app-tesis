import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, getDocs, query, collection, where, addDoc, deleteDoc, updateDoc, onSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastController } from '@ionic/angular/standalone';
import { ProfileVisibilityService } from '../../search/data-access/profile-visibility.service';

export interface GroupInvitation {
    id?: string; // ID del documento de invitación
    fromUserId: string; // Usuario que envía la invitación
    fromUserName: string; // Nombre del usuario que invita
    toUserId: string; // Usuario que recibe la invitación
    toUserName?: string; // Nombre del usuario que recibe la invitación (opcional)
    status: 'pending' | 'accepted' | 'rejected'; // Estado de la invitación
    timestamp: Date | any; // Fecha de la invitación (puede ser Date o Timestamp de Firestore)
    fromUserProfileImage?: string; // URL de la imagen de perfil del usuario que invita (opcional)
  }

@Injectable({
    providedIn: 'root'
})
export class GroupInvitationsService {
    private invitationsReceived$ = new BehaviorSubject<GroupInvitation[]>([]);
    private invitationsSent$ = new BehaviorSubject<GroupInvitation[]>([]);
    private unsubscribeInvitationsReceived: (() => void) | null = null;
    private unsubscribeInvitationsSent: (() => void) | null = null;

    constructor(
        private auth: Auth,
        private firestore: Firestore,
        private toastController: ToastController,
        private profileVisibilityService: ProfileVisibilityService
    ) {
        // Iniciar escucha de invitaciones cuando se crea el servicio
        this.initInvitationsListener();
    }

    // Obtener invitaciones recibidas para el usuario actual
    getInvitationsReceived(): Observable<GroupInvitation[]> {
        return this.invitationsReceived$.asObservable();
    }

    // Obtener invitaciones enviadas por el usuario actual
    getInvitationsSent(): Observable<GroupInvitation[]> {
        return this.invitationsSent$.asObservable();
    }

    // Iniciar escucha de invitaciones
    private initInvitationsListener(): void {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        // Cancelar suscripciones anteriores si existen
        if (this.unsubscribeInvitationsReceived) {
            this.unsubscribeInvitationsReceived();
        }
        if (this.unsubscribeInvitationsSent) {
            this.unsubscribeInvitationsSent();
        }

        // Escuchar invitaciones recibidas
        const receivedQuery = query(
            collection(this.firestore, 'groupInvitations'),
            where('toUserId', '==', currentUser.uid),
            where('status', '==', 'pending')
        );

        this.unsubscribeInvitationsReceived = onSnapshot(receivedQuery, (snapshot) => {
            const invitations: GroupInvitation[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as GroupInvitation;
                const timestamp = data.timestamp;

                let formattedDate: Date;
                // Verificar si es un objeto Timestamp de Firestore
                if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
                    formattedDate = new Date((timestamp as any).seconds * 1000);
                } else if (timestamp instanceof Date) {
                    formattedDate = timestamp;
                } else {
                    formattedDate = new Date(); // Fecha actual como fallback
                }

                invitations.push({
                    ...data,
                    id: doc.id,
                    timestamp: formattedDate
                });
            });
            this.invitationsReceived$.next(invitations);
            console.log('Invitaciones recibidas actualizadas:', invitations.length);
        }, (error) => {
            console.error('Error al escuchar invitaciones recibidas:', error);
        });

        // Escuchar invitaciones enviadas
        const sentQuery = query(
            collection(this.firestore, 'groupInvitations'),
            where('fromUserId', '==', currentUser.uid),
            where('status', '==', 'pending')
        );

        this.unsubscribeInvitationsSent = onSnapshot(sentQuery, (snapshot) => {
            const invitations: GroupInvitation[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as GroupInvitation;
                const timestamp = data.timestamp;

                let formattedDate: Date;
                // Verificar si es un objeto Timestamp de Firestore
                if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
                    formattedDate = new Date((timestamp as any).seconds * 1000);
                } else if (timestamp instanceof Date) {
                    formattedDate = timestamp;
                } else {
                    formattedDate = new Date(); // Fecha actual como fallback
                }

                invitations.push({
                    ...data,
                    id: doc.id,
                    timestamp: formattedDate
                });
            });
            this.invitationsSent$.next(invitations);
            console.log('Invitaciones enviadas actualizadas:', invitations.length);
        }, (error) => {
            console.error('Error al escuchar invitaciones enviadas:', error);
        });
    }

    // Enviar invitación a un usuario
    async sendInvitation(toUserId: string, toUserName: string): Promise<boolean> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('No hay usuario autenticado');
        }

        try {
            // Verificar si ya existe una invitación pendiente para este usuario
            const existingInvitationsQuery = query(
                collection(this.firestore, 'groupInvitations'),
                where('fromUserId', '==', currentUser.uid),
                where('toUserId', '==', toUserId),
                where('status', '==', 'pending')
            );

            const existingSnapshot = await getDocs(existingInvitationsQuery);
            if (!existingSnapshot.empty) {
                console.log('Ya existe una invitación pendiente para este usuario');
                return false;
            }

            // Obtener datos del usuario actual
            const userDoc = await getDoc(doc(this.firestore, 'usuarios', currentUser.uid));
            if (!userDoc.exists()) {
                throw new Error('No se encontraron datos del usuario actual');
            }

            const userData = userDoc.data();
            const fromUserName = userData['nombreUsuario'] || 'Usuario';
            const fromUserProfileImage = userData['profileImageUrl'] || null;

            // Crear la invitación
            const invitation: GroupInvitation = {
                fromUserId: currentUser.uid,
                fromUserName: fromUserName,
                toUserId: toUserId,
                status: 'pending',
                timestamp: new Date(),
                fromUserProfileImage: fromUserProfileImage
            };

            // Guardar la invitación en Firestore
            await addDoc(collection(this.firestore, 'groupInvitations'), invitation);
            console.log('Invitación enviada correctamente');
            return true;
        } catch (error) {
            console.error('Error al enviar invitación:', error);
            throw error;
        }
    }

    // Aceptar una invitación
    async acceptInvitation(invitationId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('No hay usuario autenticado');
        }

        try {
            // Obtener la invitación
            const invitationRef = doc(this.firestore, 'groupInvitations', invitationId);
            const invitationSnap = await getDoc(invitationRef);

            if (!invitationSnap.exists()) {
                throw new Error('La invitación no existe');
            }

            const invitation = invitationSnap.data() as GroupInvitation;

            // Verificar que la invitación es para el usuario actual
            if (invitation.toUserId !== currentUser.uid) {
                throw new Error('No tienes permiso para aceptar esta invitación');
            }

            // Actualizar el estado de la invitación
            await updateDoc(invitationRef, {
                status: 'accepted'
            });

            // Añadir el usuario al grupo
            await this.profileVisibilityService.addUserToGroup(invitation.fromUserId);

            // Mostrar notificación de éxito
            const toast = await this.toastController.create({
                message: `Has aceptado la invitación de ${invitation.fromUserName}`,
                duration: 2000,
                position: 'bottom',
                color: 'success'
            });
            await toast.present();

        } catch (error) {
            console.error('Error al aceptar invitación:', error);
            throw error;
        }
    }

    // Rechazar una invitación
    async rejectInvitation(invitationId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('No hay usuario autenticado');
        }

        try {
            // Obtener la invitación
            const invitationRef = doc(this.firestore, 'groupInvitations', invitationId);
            const invitationSnap = await getDoc(invitationRef);

            if (!invitationSnap.exists()) {
                throw new Error('La invitación no existe');
            }

            const invitation = invitationSnap.data() as GroupInvitation;

            // Verificar que la invitación es para el usuario actual
            if (invitation.toUserId !== currentUser.uid) {
                throw new Error('No tienes permiso para rechazar esta invitación');
            }

            // Actualizar el estado de la invitación
            await updateDoc(invitationRef, {
                status: 'rejected'
            });

            // Mostrar notificación
            const toast = await this.toastController.create({
                message: 'Invitación rechazada',
                duration: 2000,
                position: 'bottom',
                color: 'medium'
            });
            await toast.present();

        } catch (error) {
            console.error('Error al rechazar invitación:', error);
            throw error;
        }
    }

    // Cancelar una invitación enviada
    async cancelInvitation(invitationId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('No hay usuario autenticado');
        }

        try {
            // Obtener la invitación
            const invitationRef = doc(this.firestore, 'groupInvitations', invitationId);
            const invitationSnap = await getDoc(invitationRef);

            if (!invitationSnap.exists()) {
                throw new Error('La invitación no existe');
            }

            const invitation = invitationSnap.data() as GroupInvitation;

            // Verificar que la invitación fue enviada por el usuario actual
            if (invitation.fromUserId !== currentUser.uid) {
                throw new Error('No tienes permiso para cancelar esta invitación');
            }

            // Eliminar la invitación
            await deleteDoc(invitationRef);

            // Mostrar notificación
            const toast = await this.toastController.create({
                message: 'Invitación cancelada',
                duration: 2000,
                position: 'bottom',
                color: 'medium'
            });
            await toast.present();

        } catch (error) {
            console.error('Error al cancelar invitación:', error);
            throw error;
        }
    }

    // Limpiar suscripciones cuando se destruye el servicio
    dispose(): void {
        if (this.unsubscribeInvitationsReceived) {
            this.unsubscribeInvitationsReceived();
        }
        if (this.unsubscribeInvitationsSent) {
            this.unsubscribeInvitationsSent();
        }
    }
}
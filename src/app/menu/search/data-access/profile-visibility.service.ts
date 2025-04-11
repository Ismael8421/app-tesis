import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc, arrayRemove, arrayUnion } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileVisibilityService {
  private readonly VISIBILITY_KEY = 'profile_visibility';
  private readonly GROUP_KEY = 'user_group';
  
  private profileStatus$ = new BehaviorSubject<{
    visibility: 'visible' | 'visible_in_group' | 'invisible',
    groupMembers: string[],
    pendingInvitations: string[]
  }>({
    visibility: 'visible',
    groupMembers: [],
    pendingInvitations: []
  });
  
  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.loadProfileStatus();
  }

  // Obtener estado actual del perfil
  getProfileStatus(): Observable<{
    visibility: 'visible' | 'visible_in_group' | 'invisible',
    groupMembers: string[],
    pendingInvitations: string[]
  }> {
    return this.profileStatus$.asObservable();
  }

  // Crear un grupo con otro usuario (enviará una invitación)
  async createGroupWith(otherUserId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');

    try {
      // 1. Crear/actualizar documento del usuario actual para indicar que tiene un grupo
      await setDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        userId: currentUser.uid,
        visibility: 'visible_in_group',
        groupMembers: [], // Inicialmente vacío hasta que el otro usuario acepte
        pendingInvitations: [otherUserId], // Añadir a las invitaciones pendientes
        updatedAt: new Date()
      }, { merge: true });

      // 2. Actualizar estado local
      this.profileStatus$.next({
        visibility: 'visible_in_group',
        groupMembers: [],
        pendingInvitations: [otherUserId]
      });
    } catch (error) {
      console.error('Error al crear grupo:', error);
      throw new Error('No se pudo crear el grupo');
    }
  }

  // Añadir usuario a grupo (usado cuando se acepta una invitación)
  async addUserToGroup(groupOwnerId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    try {
      // 1. Actualizar documento del propietario del grupo para añadir al usuario
      const ownerRef = doc(this.firestore, 'profileVisibility', groupOwnerId);
      const ownerDoc = await getDoc(ownerRef);
      
      if (!ownerDoc.exists()) {
        throw new Error('El propietario del grupo no existe');
      }
      
      const ownerData = ownerDoc.data();
      const ownerGroupMembers = ownerData['groupMembers'] || [];
      const ownerPendingInvitations = ownerData['pendingInvitations'] || [];
      
      // Eliminar de pendientes y añadir a miembros
      const updatedPendingInvitations = ownerPendingInvitations.filter((id: string) => id !== currentUser.uid);
      const updatedGroupMembers = [...ownerGroupMembers, currentUser.uid];
      
      await updateDoc(ownerRef, {
        groupMembers: updatedGroupMembers,
        pendingInvitations: updatedPendingInvitations,
        updatedAt: new Date()
      });
      
      // 2. Actualizar documento del usuario actual para indicar que está en un grupo
      await setDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        userId: currentUser.uid,
        visibility: 'visible_in_group',
        groupOwnerId: groupOwnerId, // Referencia al propietario del grupo
        updatedAt: new Date()
      }, { merge: true });
      
      // 3. Actualizar estado local
      this.profileStatus$.next({
        visibility: 'visible_in_group',
        groupMembers: [],
        pendingInvitations: []
      });
      
    } catch (error) {
      console.error('Error al añadir usuario al grupo:', error);
      throw error;
    }
  }

  // Enviar invitación a grupo (usado desde el componente de búsqueda)
  async inviteToGroup(userId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    if (currentStatus.visibility !== 'visible_in_group') {
      throw new Error('Debes estar en un grupo para añadir miembros');
    }
    
    if (currentStatus.groupMembers.length + currentStatus.pendingInvitations.length >= 5) {
      throw new Error('El grupo ya tiene el máximo de miembros o invitaciones (6)');
    }
    
    try {
      // Verificar si el usuario ya está invitado o es miembro
      if (currentStatus.groupMembers.includes(userId) || currentStatus.pendingInvitations.includes(userId)) {
        throw new Error('Este usuario ya está en tu grupo o tiene una invitación pendiente');
      }
      
      // Actualizar pendingInvitations del grupo
      const updatedPendingInvitations = [...currentStatus.pendingInvitations, userId];
      
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        pendingInvitations: updatedPendingInvitations,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        ...currentStatus,
        pendingInvitations: updatedPendingInvitations
      });
    } catch (error) {
      console.error('Error al invitar usuario al grupo:', error);
      throw error;
    }
  }

  // Añadir miembro al grupo (versión existente, ahora usada para agregar después de aceptar invitación)
  async addGroupMember(newUserId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    if (currentStatus.visibility === 'visible') {
      throw new Error('Debes estar en un grupo para añadir miembros');
    }
    
    if (currentStatus.groupMembers.length >= 5) { // Máximo 6 incluyendo el usuario actual
      throw new Error('El grupo ya tiene el máximo de miembros (6)');
    }
    
    try {
      // Verificar si el usuario ya está en el grupo
      if (currentStatus.groupMembers.includes(newUserId)) {
        throw new Error('Este usuario ya está en tu grupo');
      }
      
      // Eliminar de las invitaciones pendientes si estaba allí
      const updatedPendingInvitations = currentStatus.pendingInvitations.filter(id => id !== newUserId);
      
      // Actualizar grupo
      const updatedMembers = [...currentStatus.groupMembers, newUserId];
      
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        groupMembers: updatedMembers,
        pendingInvitations: updatedPendingInvitations,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        ...currentStatus,
        groupMembers: updatedMembers,
        pendingInvitations: updatedPendingInvitations
      });
    } catch (error) {
      console.error('Error al añadir miembro al grupo:', error);
      throw error;
    }
  }

  // Eliminar invitación pendiente
  async removeInvitation(memberId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    if (currentStatus.visibility !== 'visible_in_group') {
      throw new Error('No tienes un grupo activo');
    }
    
    try {
      // Verificar si el usuario está en las invitaciones pendientes
      if (!currentStatus.pendingInvitations.includes(memberId)) {
        throw new Error('Este usuario no tiene una invitación pendiente');
      }
      
      // Actualizar grupo en Firestore usando arrayRemove para quitar la invitación
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        pendingInvitations: arrayRemove(memberId),
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      const updatedPendingInvitations = currentStatus.pendingInvitations.filter(id => id !== memberId);
      
      this.profileStatus$.next({
        ...currentStatus,
        pendingInvitations: updatedPendingInvitations
      });
    } catch (error) {
      console.error('Error al eliminar invitación:', error);
      throw error;
    }
  }

  // Eliminar miembro del grupo
  async removeMemberFromGroup(memberId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    if (currentStatus.visibility !== 'visible_in_group') {
      throw new Error('No tienes un grupo activo');
    }
    
    try {
      // Verificar si el usuario está en el grupo
      if (!currentStatus.groupMembers.includes(memberId)) {
        throw new Error('Este usuario no está en tu grupo');
      }
      
      // Actualizar grupo en Firestore usando arrayRemove para quitar al miembro específico
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        groupMembers: arrayRemove(memberId),
        updatedAt: new Date()
      });
      
      // Actualizar el documento del miembro eliminado
      await updateDoc(doc(this.firestore, 'profileVisibility', memberId), {
        visibility: 'visible',
        groupOwnerId: null,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      const updatedMembers = currentStatus.groupMembers.filter(id => id !== memberId);
      
      this.profileStatus$.next({
        ...currentStatus,
        groupMembers: updatedMembers
      });
    } catch (error) {
      console.error('Error al eliminar miembro del grupo:', error);
      throw error;
    }
  }

  // Cambiar visibilidad del perfil
  async changeVisibility(visibility: 'visible' | 'visible_in_group' | 'invisible'): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    try {
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        visibility,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        ...currentStatus,
        visibility
      });
    } catch (error) {
      console.error('Error al cambiar visibilidad del perfil:', error);
      throw new Error('No se pudo cambiar la visibilidad');
    }
  }

  // Salir del grupo
  async leaveGroup(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    try {
      const profileRef = doc(this.firestore, 'profileVisibility', currentUser.uid);
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        
        // Comprobar si es propietario o miembro
        if (data['groupOwnerId']) {
          // Es un miembro, notificar al propietario
          const ownerId = data['groupOwnerId'];
          const ownerRef = doc(this.firestore, 'profileVisibility', ownerId);
          const ownerDoc = await getDoc(ownerRef);
          
          if (ownerDoc.exists()) {
            // Eliminar al usuario de la lista de miembros del propietario
            await updateDoc(ownerRef, {
              groupMembers: arrayRemove(currentUser.uid),
              updatedAt: new Date()
            });
          }
        } else {
          // Es propietario, liberar a todos los miembros
          const members = data['groupMembers'] || [];
          
          // Actualizar el estado de cada miembro
          for (const memberId of members) {
            try {
              await updateDoc(doc(this.firestore, 'profileVisibility', memberId), {
                visibility: 'visible',
                groupOwnerId: null,
                updatedAt: new Date()
              });
            } catch (e) {
              console.error(`Error al liberar miembro ${memberId}:`, e);
            }
          }
        }
      }
      
      // Finalmente, actualizar estado del usuario actual
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        visibility: 'visible',
        groupMembers: [],
        pendingInvitations: [],
        groupOwnerId: null,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        visibility: 'visible',
        groupMembers: [],
        pendingInvitations: []
      });
    } catch (error) {
      console.error('Error al salir del grupo:', error);
      throw new Error('No se pudo salir del grupo');
    }
  }

  // Cargar estado del perfil
  private async loadProfileStatus(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;
    
    try {
      const docRef = doc(this.firestore, 'profileVisibility', currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.profileStatus$.next({
          visibility: data['visibility'] || 'visible',
          groupMembers: data['groupMembers'] || [],
          pendingInvitations: data['pendingInvitations'] || []
        });
      } else {
        // Crear documento por defecto
        await setDoc(docRef, {
          userId: currentUser.uid,
          visibility: 'visible',
          groupMembers: [],
          pendingInvitations: [],
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error al cargar estado del perfil:', error);
    }
  }
}
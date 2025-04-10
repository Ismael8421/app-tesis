import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProfileVisibilityService {
  private readonly VISIBILITY_KEY = 'profile_visibility';
  private readonly GROUP_KEY = 'user_group';
  
  private profileStatus$ = new BehaviorSubject<{
    visibility: 'visible' | 'visible_in_group' | 'invisible',
    groupMembers: string[]
  }>({
    visibility: 'visible',
    groupMembers: []
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
    groupMembers: string[]
  }> {
    return this.profileStatus$.asObservable();
  }

  // Crear un grupo con otro usuario
  async createGroupWith(otherUserId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');

    try {
      // 1. Crear/actualizar documento del usuario actual
      await setDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        userId: currentUser.uid,
        visibility: 'visible_in_group',
        groupMembers: [otherUserId],
        updatedAt: new Date()
      }, { merge: true });

      // 2. Actualizar estado local
      this.profileStatus$.next({
        visibility: 'visible_in_group',
        groupMembers: [otherUserId]
      });
    } catch (error) {
      console.error('Error al crear grupo:', error);
      throw new Error('No se pudo crear el grupo');
    }
  }

  // Añadir miembro al grupo
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
      
      // Actualizar grupo
      const updatedMembers = [...currentStatus.groupMembers, newUserId];
      
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        groupMembers: updatedMembers,
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        ...currentStatus,
        groupMembers: updatedMembers
      });
    } catch (error) {
      console.error('Error al añadir miembro al grupo:', error);
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
      await updateDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        visibility: 'visible',
        groupMembers: [],
        updatedAt: new Date()
      });
      
      // Actualizar estado local
      this.profileStatus$.next({
        visibility: 'visible',
        groupMembers: []
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
          groupMembers: data['groupMembers'] || []
        });
      } else {
        // Crear documento por defecto
        await setDoc(docRef, {
          userId: currentUser.uid,
          visibility: 'visible',
          groupMembers: [],
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error al cargar estado del perfil:', error);
    }
  }
}
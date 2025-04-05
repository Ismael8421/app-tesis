import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, arrayUnion, arrayRemove } from '@angular/fire/firestore';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RejectedProfilesService {
  private readonly REJECTED_PROFILES_KEY = 'rejected_profiles';
  private rejectedProfiles$ = new BehaviorSubject<string[]>([]);
  
  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.loadRejectedProfiles();
  }

  /**
   * Obtiene el observable con la lista de perfiles rechazados
   */
  getRejectedProfiles(): Observable<string[]> {
    return this.rejectedProfiles$.asObservable();
  }

  /**
   * Rechaza un perfil para el usuario actual
   * @param profileId ID del perfil a rechazar
   */
  async rejectProfile(profileId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      // 1. Agregar a Firebase
      const userRejectionsRef = doc(this.firestore, `userRejections/${currentUser.uid}`);
      await setDoc(userRejectionsRef, {
        rejectedProfiles: arrayUnion(profileId),
        lastUpdated: new Date()
      }, { merge: true });

      // 2. Actualizar estado local
      const currentRejections = this.rejectedProfiles$.value || [];
      if (!currentRejections.includes(profileId)) {
        const updatedRejections = [...currentRejections, profileId];
        this.rejectedProfiles$.next(updatedRejections);
        
        // 3. Guardar en almacenamiento local
        await this.saveToLocalStorage(updatedRejections);
      }

      console.log(`Perfil ${profileId} rechazado correctamente`);
    } catch (error) {
      console.error('Error al rechazar perfil:', error);
      throw new Error('No se pudo rechazar el perfil');
    }
  }

  /**
   * Quita un perfil de la lista de rechazados
   * @param profileId ID del perfil a quitar de rechazados
   */
  async unrejectProfile(profileId: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      // 1. Eliminar de Firebase
      const userRejectionsRef = doc(this.firestore, `userRejections/${currentUser.uid}`);
      await setDoc(userRejectionsRef, {
        rejectedProfiles: arrayRemove(profileId),
        lastUpdated: new Date()
      }, { merge: true });

      // 2. Actualizar estado local
      const currentRejections = this.rejectedProfiles$.value || [];
      const updatedRejections = currentRejections.filter(id => id !== profileId);
      this.rejectedProfiles$.next(updatedRejections);
      
      // 3. Guardar en almacenamiento local
      await this.saveToLocalStorage(updatedRejections);

      console.log(`Perfil ${profileId} eliminado de rechazados correctamente`);
    } catch (error) {
      console.error('Error al quitar perfil de rechazados:', error);
      throw new Error('No se pudo quitar el perfil de rechazados');
    }
  }

  /**
   * Verifica si un perfil está rechazado
   * @param profileId ID del perfil a verificar
   * @returns true si el perfil está rechazado, false en caso contrario
   */
  isProfileRejected(profileId: string): boolean {
    const rejectedProfiles = this.rejectedProfiles$.value || [];
    return rejectedProfiles.includes(profileId);
  }

  /**
   * Carga los perfiles rechazados desde Firebase y el almacenamiento local
   */
  private async loadRejectedProfiles(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      // Primero intentar cargar desde el almacenamiento local para respuesta rápida
      const localRejections = await this.loadFromLocalStorage();
      
      if (localRejections.length > 0) {
        this.rejectedProfiles$.next(localRejections);
      }
      
      // Luego cargar desde Firebase para tener datos actualizados
      const userRejectionsRef = doc(this.firestore, `userRejections/${currentUser.uid}`);
      const docSnap = await getDoc(userRejectionsRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const firebaseRejections = data['rejectedProfiles'] || [];
        
        // Actualizar el estado y el almacenamiento local solo si hay cambios
        if (JSON.stringify(firebaseRejections) !== JSON.stringify(localRejections)) {
          this.rejectedProfiles$.next(firebaseRejections);
          await this.saveToLocalStorage(firebaseRejections);
        }
      } else if (localRejections.length > 0) {
        // Si hay rechazos locales pero no en Firebase, sincronizar hacia arriba
        await setDoc(userRejectionsRef, {
          rejectedProfiles: localRejections,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      console.error('Error al cargar perfiles rechazados:', error);
    }
  }

  /**
   * Guarda la lista de perfiles rechazados en el almacenamiento local
   */
  private async saveToLocalStorage(rejectedProfiles: string[]): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      const key = `${this.REJECTED_PROFILES_KEY}_${currentUser.uid}`;
      await Preferences.set({
        key,
        value: JSON.stringify(rejectedProfiles)
      });
    } catch (error) {
      console.error('Error guardando perfiles rechazados en almacenamiento local:', error);
    }
  }

  /**
   * Carga la lista de perfiles rechazados desde el almacenamiento local
   */
  private async loadFromLocalStorage(): Promise<string[]> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return [];

    try {
      const key = `${this.REJECTED_PROFILES_KEY}_${currentUser.uid}`;
      const { value } = await Preferences.get({ key });
      
      if (!value) return [];
      
      return JSON.parse(value) as string[];
    } catch (error) {
      console.error('Error cargando perfiles rechazados desde almacenamiento local:', error);
      return [];
    }
  }

  /**
   * Limpia los perfiles rechazados para el usuario actual (útil al cerrar sesión)
   */
  async clearRejectedProfiles(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      const key = `${this.REJECTED_PROFILES_KEY}_${currentUser.uid}`;
      await Preferences.remove({ key });
      this.rejectedProfiles$.next([]);
    } catch (error) {
      console.error('Error al limpiar perfiles rechazados:', error);
    }
  }
}
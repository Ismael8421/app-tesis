import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserActivityService } from '../../shared/data-access/user-activity.service';

export type VisibilityType = 'visible' | 'visible_in_group' | 'invisible';

@Injectable({
  providedIn: 'root'
})
export class ProfileVisibilityService {
  private readonly VISIBILITY_KEY = 'profile_visibility';
  
  private profileStatus$ = new BehaviorSubject<{
    visibility: VisibilityType
  }>({
    visibility: 'visible'
  });
  
  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.loadProfileStatus();
  }

  // Obtener estado actual del perfil
  getProfileStatus(): Observable<{
    visibility: VisibilityType
  }> {
    return this.profileStatus$.asObservable();
  }

  // Cambiar visibilidad del perfil
  async changeVisibility(visibility: VisibilityType): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('No hay usuario autenticado');
    
    const currentStatus = this.profileStatus$.value;
    
    try {
      // Guardamos la fecha de actualización
      await setDoc(doc(this.firestore, 'profileVisibility', currentUser.uid), {
        visibility,
        updatedAt: new Date()
      }, { merge: true });
      
      // Actualizar estado local
      this.profileStatus$.next({
        ...currentStatus,
        visibility
      });
      
      // Si se está integrando con UserActivityService, registrar esta acción como actividad
      try {
        // Verificar si el servicio está disponible mediante inyección dinámica
        const activityService = inject(UserActivityService, { optional: true });
        if (activityService) {
          activityService.registerActivity('visibility_change');
        }
      } catch (e) {
        // Si no está disponible el servicio, ignorar silenciosamente
        console.log('UserActivityService no disponible, no se registra actividad');
      }
    } catch (error) {
      console.error('Error al cambiar visibilidad del perfil:', error);
      throw new Error('No se pudo cambiar la visibilidad');
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
          visibility: data['visibility'] || 'visible'
        });
      } else {
        // Crear documento por defecto
        await setDoc(docRef, {
          userId: currentUser.uid,
          visibility: 'visible',
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error al cargar estado del perfil:', error);
    }
  }
}
// src/app/menu/configs/profile/preferences.service.ts
import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  
  constructor(private firestore: Firestore) { }

  /**
   * Resetea el estado del formulario de preferencias para que el usuario
   * pueda completarlo nuevamente
   * 
   * @param userId ID del usuario
   * @returns Promise que se resuelve cuando se actualiza el valor
   */
  async resetPreferencesForm(userId: string): Promise<void> {
    try {
      // Referencia al documento del usuario
      const userRef = doc(this.firestore, 'usuarios', userId);
      
      // Actualizar el campo formCompleted a false
      await updateDoc(userRef, {
        formCompleted: false
      });
      
      console.log('Estado del formulario de preferencias restablecido correctamente');
      return Promise.resolve();
    } catch (error) {
      console.error('Error al restablecer el formulario de preferencias:', error);
      return Promise.reject(error);
    }
  }
}
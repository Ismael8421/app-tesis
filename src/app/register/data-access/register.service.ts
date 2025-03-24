// src/app/register/data-access/register.service.ts
// Actualización del servicio para manejar datos parciales y verificación de perfil

import { Injectable, inject } from '@angular/core';
import { Firestore, setDoc, doc, getDoc } from '@angular/fire/firestore';

export interface userCreate {
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  anioLectivo: string;
  carrera: string;
  mencion?: string;
  uid?: string;
}

// Clave para almacenar datos temporales del formulario
const FORM_STORAGE_KEY = 'pendingRegistrationForm';

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  private getCollectionName(carrera: string): string {
    // Eliminar tildes y espacios para mayor consistencia
    const normalizeCarrera = carrera.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
    
    return normalizeCarrera;
  }

  async getUserData(uid: string): Promise<userCreate | null> {
    try {
      // Primero obtener la referencia de la colección general
      const generalUserDoc = doc(this._firestore, `usuarios/${uid}`);
      const generalUserSnapshot = await getDoc(generalUserDoc);
      
      if (!generalUserSnapshot.exists()) {
        console.log('No se encontró el documento del usuario');
        return null;
      }
    
      // Obtener la carrera del usuario
      const { carrera } = generalUserSnapshot.data();
      
      // Obtener los datos específicos de la carrera
      const collectionName = this.getCollectionName(carrera);
      const userDoc = doc(this._firestore, `${collectionName}/${uid}`);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        return userSnapshot.data() as userCreate;
      } else {
        console.log('No se encontró el documento específico del usuario');
        return null;
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      throw error;
    }
  }

  async create(uid: string, user: userCreate) {
    try {
      // Verificar si el nombre de usuario ya está tomado
      const isUsernameTaken = await this.isUsernameTaken(user.nombreUsuario);
      if (isUsernameTaken) {
        throw new Error(`El nombre de usuario "${user.nombreUsuario}" ya está en uso`);
      }
  
      const userWithUID = { ...user, uid };
      const collectionName = this.getCollectionName(user.carrera);
      
      // Crear el documento en la colección específica de la carrera
      const userDoc = doc(this._firestore, `${collectionName}/${uid}`);
      await setDoc(userDoc, userWithUID);
      
      // También guardamos una referencia en la colección general de usuarios
      const generalUserDoc = doc(this._firestore, `usuarios/${uid}`);
      await setDoc(generalUserDoc, {
        carrera: user.carrera,
        uid: uid
      });
  
      // Vincular el nombre de usuario al UID
      await this.linkUsernameToUID(user.nombreUsuario, uid);
  
      // Limpiar datos guardados temporalmente
      this.clearSavedFormData(uid);
  
      console.log(`Documento creado con éxito en la colección ${collectionName}`);
    } catch (error) {
      console.error('Error al escribir en Firestore:', error);
      throw error;
    }
  }

  async linkUsernameToUID(username: string, uid: string): Promise<void> {
    try {
      const usernameDoc = doc(this._firestore, `usernames/${username}`);
      await setDoc(usernameDoc, { uid });
      console.log('Nombre de usuario vinculado con éxito');
    } catch (error) {
      console.error('Error al vincular el nombre de usuario:', error);
      throw error;
    }
  }

  // --- Métodos nuevos para manejar datos parciales ---

  /**
   * Guarda temporalmente los datos del formulario para un UID específico
   */
  saveFormData(uid: string, formData: Partial<userCreate>): void {
    try {
      const key = `${FORM_STORAGE_KEY}_${uid}`;
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (error) {
      console.error('Error al guardar datos del formulario:', error);
    }
  }

  /**
   * Recupera los datos temporales guardados para un UID específico
   */
  getSavedFormData(uid: string): Partial<userCreate> | null {
    try {
      const key = `${FORM_STORAGE_KEY}_${uid}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error al recuperar datos del formulario:', error);
      return null;
    }
  }

  /**
   * Limpia los datos temporales guardados para un UID específico
   */
  clearSavedFormData(uid: string): void {
    try {
      const key = `${FORM_STORAGE_KEY}_${uid}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error al limpiar datos del formulario:', error);
    }
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    try {
      const usernameDoc = doc(this._firestore, `usernames/${username}`);
      const usernameSnapshot = await getDoc(usernameDoc);
      
      return usernameSnapshot.exists();
    } catch (error) {
      console.error('Error al verificar el nombre de usuario:', error);
      throw error;
    }
  }
}
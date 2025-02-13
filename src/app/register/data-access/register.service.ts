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

  async getUserData(uid: string, carrera: string): Promise<userCreate | null> {
    try {
      const collectionName = this.getCollectionName(carrera);
      const userDoc = doc(this._firestore, `${collectionName}/${uid}`);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        return userSnapshot.data() as userCreate;
      } else {
        console.log('No se encontró el documento del usuario');
        return null;
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      throw error;
    }
  }

  async create(uid: string, user: userCreate) {
    try {
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

}

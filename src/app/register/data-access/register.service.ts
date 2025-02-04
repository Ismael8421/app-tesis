import { Injectable, inject } from '@angular/core';
import { Firestore, setDoc, doc, getDoc } from '@angular/fire/firestore';

export interface userCreate {
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  anioLectivo: string;
  carrera: string;
  uid?: string;
}


@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  async getUserData(uid: string): Promise<userCreate | null> {
    try {
      const userDoc = doc(this._firestore, `usuarios/${uid}`);
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
      const userDoc = doc(this._firestore, `usuarios/${uid}`); // Usar UID como nombre del documento
      await setDoc(userDoc, userWithUID);
      console.log('Documento creado con éxito');
    } catch (error) {
      console.error('Error al escribir en Firestore:', error);
    }
  }

  async linkUsernameToUID(username: string, uid: string): Promise<void> {
    try {
      const usernameDoc = doc(this._firestore, `usernames/${username}`);
      await setDoc(usernameDoc, { uid });
      console.log('Nombre de usuario vinculado con éxito');
    } catch (error) {
      console.error('Error al vincular el nombre de usuario:', error);
      throw error; // Para manejar el error en el componente
    }
  }

}

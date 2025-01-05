import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, setDoc, doc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface preference {
  auto: string;
  buscado: string;
}

export interface userCreate {
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  curso: string;
  carrera: string;
  uid?: string;
  preferencias:{
    compromiso: preference;
    comunicacion: preference;
    conocimientos_tecnicos: preference;
    creatividad: preference;
    liderazgo: preference;
    tiempo: preference;
  }
}


@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

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

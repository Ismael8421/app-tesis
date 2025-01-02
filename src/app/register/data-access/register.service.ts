import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, setDoc, doc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface userCreate {
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  curso: string;
  carrera: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  async create(uid: string, user: userCreate) {
    try {
      const userDoc = doc(this._firestore, `usuarios/${uid}`); // Usar UID como nombre del documento
      await setDoc(userDoc, user);
      console.log('Documento creado con éxito');
    } catch (error) {
      console.error('Error al escribir en Firestore:', error);
    }
  }
}

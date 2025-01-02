import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth'; // Importar el servicio de autenticación


export interface user {
  id: string;
  nombre: string;
  apellido: string;
  curso: string;
  carrera: string;
}

export type userCreate = Omit<user, 'id'>;

const PATH = 'estudiante';

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  private _collection = collection(this._firestore, PATH);

  create(User: userCreate) {
    return addDoc(this._collection, User);
  }
}

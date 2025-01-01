import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

export interface user {
  id: string;
  nombre: string;
}

export type userCreate = Omit<user, 'id'>;

const PATH = 'estudiante';

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  private _collection = collection(this._firestore, PATH);

  create(user: userCreate) {
    return addDoc(this._collection, user);
  }
}

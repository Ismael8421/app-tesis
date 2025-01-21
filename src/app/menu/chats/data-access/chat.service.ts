import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';

export interface chat {
  image: string;
  name: string;
  lastMessage: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private _firestore = inject(Firestore)
  private _collection = collection(this._firestore, 'chats');
  public chats: any[] = [];

  constructor() { }

  cargarMensajes() {
    // this._collection = this._firestore.collection('chats');
  }
}
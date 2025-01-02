import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, User as FirebaseUser } from '@angular/fire/auth';

export interface User {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _auth = inject(Auth);

  // Método público para obtener el usuario autenticado
  get currentUser(): FirebaseUser | null {
    return this._auth.currentUser;
  }

  signUp(user: User) {
    return createUserWithEmailAndPassword(
      this._auth, 
      user.email, 
      user.password
    );
  }

  signIn(user: User) {
    return signInWithEmailAndPassword(
      this._auth, 
      user.email, 
      user.password
    );
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this._auth, provider);
  }
}

import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, User as FirebaseUser, sendPasswordResetEmail } from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';

export interface User {
  email: string;                                                             
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth: Auth = inject(Auth);
  private readonly firestore: Firestore = inject(Firestore);

  get currentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  async resetPassword(email: string):Promise<void>{
    try {
      return sendPasswordResetEmail(this.auth, email); 
    } catch (error) {console.log(error)}
  }

  async signUp(user: User) {
    try {
      // 1. Crear el usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        this.auth, 
        user.email, 
        user.password
      );

      // 2. Guardar en Firestore
      const credentialsCollection = collection(this.firestore, 'credenciales');
      const userDoc = doc(credentialsCollection, userCredential.user.uid);
      
      await setDoc(userDoc, {
        email: user.email,
        password: user.password,
        createdAt: new Date().toISOString()
      });

      return userCredential;
    } catch (error) {
      console.error('Error en signUp:', error);
      throw error;
    }
  }

  signIn(user: User) {
    return signInWithEmailAndPassword(
      this.auth, 
      user.email, 
      user.password
    );
  }

  signInWithGoogle() {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }
}
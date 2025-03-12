import { Injectable, inject } from '@angular/core';
import {
  Auth, GoogleAuthProvider, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect,
  User as FirebaseUser, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  updatePassword,
  getRedirectResult
} from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Platform } from '@ionic/angular';

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
  private readonly platform: Platform = inject(Platform);

  get currentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  async resetPassword(email: string): Promise<void> {
    try {
      return sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      console.log(error);
      throw error;
    }
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

  async signInWithGoogle() {
    try {
      if (this.platform.is('capacitor')) {
        // Usar el plugin de Capacitor Firebase Authentication
        const result = await FirebaseAuthentication.signInWithGoogle();
        return result;
      } else {
        // Tu código actual para web
        const provider = new GoogleAuthProvider();
        return signInWithPopup(this.auth, provider);
      }
    } catch (error) {
      console.error('Error en signInWithGoogle:', error);
      throw error;
    }
  }

  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  async getRedirectResult() {
    try {
      return await getRedirectResult(this.auth);
    } catch (error) {
      console.error('Error al obtener resultado de redirección:', error);
      return null;
    }
  }

  async reauthenticateUser(password: string): Promise<void> {
    try {
      const user = this.currentUser;
      if (!user?.email) throw new Error('No hay usuario autenticado');
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } catch (error) {
      console.error('Error en reautenticación:', error);
      throw error;
    }
  }

  async initiateEmailUpdate(newEmail: string): Promise<void> {
    try {
      const user = this.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');
      return verifyBeforeUpdateEmail(user, newEmail);
    } catch (error) {
      console.error('Error iniciando actualización de email:', error);
      throw error;
    }
  }

  async updateUserPassword(newPassword: string): Promise<void> {
    try {
      const user = this.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');
      return updatePassword(user, newPassword);
    } catch (error) {
      console.error('Error actualizando contraseña:', error);
      throw error;
    }
  }

  async sendVerificationEmail(): Promise<void> {
    try {
      const user = this.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');
      return sendEmailVerification(user);
    } catch (error) {
      console.error('Error enviando email de verificación:', error);
      throw error;
    }
  }
}
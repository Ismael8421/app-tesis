import { Injectable, inject } from '@angular/core';
import {
  Auth, GoogleAuthProvider, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, signInWithRedirect,
  User as FirebaseUser, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider,
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  updatePassword,
  getRedirectResult,
  fetchSignInMethodsForEmail
} from '@angular/fire/auth';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Platform } from '@ionic/angular';

export interface User {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
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

  // Método para obtener mensajes de error durante el registro
  getSignUpErrorMessage(error: any): { type: 'email' | 'password' | 'general'; message: string } {
    // Error predeterminado
    let result = { type: 'general', message: 'Error al registrar usuario' } as const;
    
    if (!error || !error.code) {
      return result;
    }
    
    console.log('Código de error en registro:', error.code);
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        return { type: 'email', message: 'Este correo ya está registrado' };
      
      case 'auth/invalid-email':
        return { type: 'email', message: 'Formato de correo inválido' };
      
      case 'auth/weak-password':
        return { type: 'password', message: 'La contraseña es demasiado débil' };
      
      case 'auth/network-request-failed':
        return { type: 'general', message: 'Error de conexión. Verifica tu internet' };
      
      default:
        return { type: 'general', message: `Error: ${error.message || 'Desconocido'}` };
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

  // Método para interpretar errores de autenticación
  getAuthErrorMessage(error: any): { type: 'email' | 'password' | 'general'; message: string } {
    // Error predeterminado
    let result = { type: 'general', message: 'Error al iniciar sesión' } as const;
    
    if (!error || !error.code) {
      return result;
    }
    
    console.log('Código de error Firebase:', error.code);
    
    switch (error.code) {
      case 'auth/user-not-found':
        return { type: 'email', message: 'Este correo no está registrado' };
      
      case 'auth/wrong-password':
        return { type: 'password', message: 'Contraseña incorrecta' };
      
      case 'auth/invalid-email':
        return { type: 'email', message: 'Formato de correo inválido' };
      
      case 'auth/invalid-credential':
        // Este error puede significar correo no existente o contraseña incorrecta
        // Para mantener la seguridad, indicamos que las credenciales son incorrectas
        return { type: 'general', message: 'Credenciales incorrectas' };
      
      case 'auth/too-many-requests':
        return { type: 'general', message: 'Demasiados intentos. Intenta más tarde o restablece tu contraseña' };
      
      case 'auth/network-request-failed':
        return { type: 'general', message: 'Error de conexión. Verifica tu internet' };
      
      default:
        return { type: 'general', message: `Error: ${error.message || 'Desconocido'}` };
    }
  }

  // Método mejorado para iniciar sesión con mejor manejo de errores
  async signIn(user: User) {
    try {
      return await signInWithEmailAndPassword(
        this.auth,
        user.email,
        user.password
      );
    } catch (error: any) {
      const firebaseError = error as AuthError;
      console.error('Error de autenticación:', firebaseError);
      throw firebaseError;
    }
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
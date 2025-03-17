import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../data-access/auth.service';
import { Router, RouterLink } from '@angular/router';
import { hasEmailError, isRequired } from '../utils/validators';
import { NgIf } from '@angular/common';
import { GoogleButtonComponent } from '../../../../UI/google-button/google-button.component';
import { EyeButtonComponent } from '../../../../UI/eye-button/eye-button.component';
import { IonInput, IonButton, IonContent, IonLabel, ToastController } from '@ionic/angular/standalone';

export interface FormSignIn {
  email: FormControl<string | null>;
  password: FormControl<string | null>;
}

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, RouterLink, GoogleButtonComponent, EyeButtonComponent, IonContent, IonLabel, IonInput, IonButton ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss'
})
export default class SignInComponent {
  private _formBuilder = inject(FormBuilder);
  private _authServices = inject(AuthService);
  private _router = inject(Router);
  private toastController = inject(ToastController);

  // Estados para los mensajes de error
  emailError = '';
  passwordError = '';
  generalError = '';
  isSubmitting = false;

  form = this._formBuilder.group<FormSignIn>({
    email: this._formBuilder.control('', [Validators.required, Validators.email]),
    password: this._formBuilder.control('', Validators.required),
  });

  constructor() {
    // Escuchar cambios en el campo de correo para resetear estados
    this.form.get('email')?.valueChanges.subscribe(() => {
      this.emailError = '';
      this.generalError = '';
    });
    
    // Escuchar cambios en el campo de contraseña para resetear errores
    this.form.get('password')?.valueChanges.subscribe(() => {
      this.passwordError = '';
      this.generalError = '';
    });
  }

  async showToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
    });
  
    await toast.present();
  }

  isRequired(field: 'email' | 'password') {
    return isRequired(field, this.form);
  }

  hasEmailError() {
    return hasEmailError(this.form);
  }

  // Variable para controlar la visibilidad de la contraseña
  passwordVisible = false;

  // Función para alternar la visibilidad de la contraseña
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  // Obtener el tipo de input para la contraseña
  get passwordInputType(): string {
    return this.passwordVisible ? 'text' : 'password';
  }

  async submit() {
    // Resetear errores
    this.emailError = '';
    this.passwordError = '';
    this.generalError = '';
    
    if (this.form.invalid) {
      // Marcar todos los campos como tocados para mostrar validaciones
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    const { email, password } = this.form.value;
    if (!email || !password) return;

    try {
      this.isSubmitting = true;
      
      // Intenta el inicio de sesión directamente
      await this._authServices.signIn({ email, password });
      
      // Si llega aquí, el inicio de sesión fue exitoso
      this.isSubmitting = false;
      this._router.navigateByUrl('/menu');
      await this.showToast('Inicio de sesión correcto');
    } catch (error: any) {
      this.isSubmitting = false;
      console.error('Error de autenticación:', error);
      
      // Obtener mensaje específico basado en el código de error
      const errorInfo = this._authServices.getAuthErrorMessage(error);
      
      if (errorInfo.type === 'email') {
        this.emailError = errorInfo.message;
      } else if (errorInfo.type === 'password') {
        this.passwordError = errorInfo.message;
      } else {
        this.generalError = errorInfo.message;
      }
      
      // await this.showToast(errorInfo.message);
    }
  }

  async submitWithGoogle() {
    try {
      this.isSubmitting = true;
      const result = await this._authServices.signInWithGoogle();
      this.isSubmitting = false;
      
      if (result) {
        this._router.navigateByUrl('/menu');
        await this.showToast('Inicio de sesión con Google correcto');
      }
    } catch (error) {
      this.isSubmitting = false;
      console.error('Error al iniciar sesión con Google:', error);
      await this.showToast('Error al iniciar sesión con Google');
    }
  }
}
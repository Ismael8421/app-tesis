import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { hasEmailError, isRequired } from '../utils/validators';
import { NgIf, NgClass } from '@angular/common';
import { AuthService } from '../../data-access/auth.service';
import { Router, RouterLink } from '@angular/router';
import { GoogleButtonComponent } from '../../../../UI/google-button/google-button.component';
import { EyeButtonComponent } from '../../../../UI/eye-button/eye-button.component';
import { IonButton, IonContent, IonInput, IonLabel } from '@ionic/angular/standalone';
import { passwordStrengthValidator, getPasswordStrengthMessage, PasswordStrength } from '../utils/password-validator';

interface FormSignUp {
  email: FormControl<string | null>;
  password: FormControl<string | null>;
  confirmPassword: FormControl<string | null>;
}

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgClass, RouterLink, GoogleButtonComponent, EyeButtonComponent, IonContent, IonLabel, IonInput, IonButton],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss'
})
export default class SignUpComponent {
  private _formBuilder = inject(FormBuilder);
  private _authServices = inject(AuthService);
  private _router = inject(Router);

  // Para campos email y password usamos la función importada
  isRequired(field: 'email' | 'password') {
    return isRequired(field, this.form)
  }

  // Nueva función específica para confirmPassword
  isConfirmPasswordRequired(): boolean {
    return this.form.get('confirmPassword')?.hasError('required') &&
      this.form.get('confirmPassword')?.touched || false;
  }

  hasEmailError() {
    return hasEmailError(this.form);
  }

  passwordsMatch(): boolean {
    const password = this.form.get('password')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    return password === confirmPassword;
  }

  // Método para verificar si la contraseña tiene error de fortaleza
  hasPasswordStrengthError(): boolean {
    return this.form.get('password')?.hasError('passwordStrength') &&
      this.form.get('password')?.touched || false;
  }

  // Método para obtener los detalles de la fortaleza de la contraseña
  getPasswordStrength(): PasswordStrength | null {
    const passwordControl = this.form.get('password');
    const password = passwordControl?.value;
    
    if (password) {
      const hasMinLength = password.length >= 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
      const valid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
      
      return {
        hasMinLength,
        hasUpperCase,
        hasLowerCase,
        hasNumber,
        hasSpecialChar,
        valid
      };
    }
    
    return null;
  }

  // Método para obtener el mensaje de error de la contraseña
  getPasswordErrorMessage(): string {
    const strength = this.getPasswordStrength();
    if (strength) {
      return getPasswordStrengthMessage(strength);
    }
    return '';
  }
  
  // Método para calcular el porcentaje de fortaleza
  calculateStrengthPercentage(): number {
    const strength = this.getPasswordStrength();
    if (!strength) return 0;
    
    // Contamos cuántos criterios cumple la contraseña
    let criteriaCount = 0;
    if (strength.hasMinLength) criteriaCount++;
    if (strength.hasUpperCase) criteriaCount++;
    if (strength.hasLowerCase) criteriaCount++;
    if (strength.hasNumber) criteriaCount++;
    if (strength.hasSpecialChar) criteriaCount++;
    
    // Devuelve el porcentaje de criterios cumplidos (0-100)
    return (criteriaCount / 5) * 100;
  }
  
  // Método para determinar la clase de estilo según la fortaleza
  getStrengthClass(): string {
    const percentage = this.calculateStrengthPercentage();
    
    if (percentage <= 20) {
      return 'strength-weak';
    } else if (percentage <= 60) {
      return 'strength-medium';
    } else if (percentage <= 80) {
      return 'strength-strong';
    } else {
      return 'strength-very-strong';
    }
  }

  form = this._formBuilder.group<FormSignUp>({
    email: this._formBuilder.control('', [Validators.required, Validators.email]),
    password: this._formBuilder.control('', [Validators.required, passwordStrengthValidator()]),
    confirmPassword: this._formBuilder.control('', Validators.required)
  });

  // Propiedades para controlar la visibilidad de las contraseñas
  passwordVisible = false;
  confirmPasswordVisible = false;

  // Métodos para alternar la visibilidad
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPasswordVisibility() {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  // Método para obtener el tipo de input
  getPasswordInputType(field: 'password' | 'confirm'): string {
    return field === 'password'
      ? (this.passwordVisible ? 'text' : 'password')
      : (this.confirmPasswordVisible ? 'text' : 'password');
  }

  async submit() {
    if (this.form.invalid) {
      // Marcar todos los controles como tocados para mostrar errores
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        control?.markAsTouched();
      });
      return;
    }
    
    if (!this.passwordsMatch()) {
      return;
    }

    try {
      const { email, password } = this.form.value;
      if (!email || !password) return;
      await this._authServices.signUp({ email, password });
      this._router.navigateByUrl('/register');
    } catch (error) {
      console.error('Error al registrar usuario:', error);
    }
  }

  async submitWithGoogle() {
    try {
      const result = await this._authServices.signInWithGoogle();
      if (result) {
        // El usuario ha iniciado sesión correctamente
        this._router.navigateByUrl('/menu');
      }
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
    }
  }
}
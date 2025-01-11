import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { hasEmailError, isRequired } from '../utils/validators';
import { NgIf } from '@angular/common';
import { AuthService } from '../../data-access/auth.service';
import { Router, RouterLink } from '@angular/router';
import { GoogleButtonComponent } from '../../ui/google-button/google-button.component';
import { EyeButtonComponent } from '../../ui/eye-button/eye-button.component';

interface FormSignUp {
  email: FormControl<string | null>;
  password: FormControl<string | null>;
  confirmPassword: FormControl<string | null>;
}

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, RouterLink, GoogleButtonComponent, EyeButtonComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css'
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

  form = this._formBuilder.group<FormSignUp>({
    email: this._formBuilder.control('', [Validators.required, Validators.email]),
    password: this._formBuilder.control('', Validators.required),
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
    if (this.form.invalid) return;
    if (!this.passwordsMatch()) {
      // Aquí podrías manejar el error, por ejemplo mostrando un mensaje
      return;
    }

    try {
      const { email, password } = this.form.value;
      if (!email || !password) return;
      await this._authServices.signUp({ email, password });
      this._router.navigateByUrl('/register');
    } catch (error) {
    }
  }

  async submitWithGoogle() {
    try {
      await this._authServices.signInWithGoogle();
      this._router.navigateByUrl('/register');
    } catch (error) {
    }
  }
}
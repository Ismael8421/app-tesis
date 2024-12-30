import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../data-access/auth.service';
import { Router, RouterLink } from '@angular/router';
import { hasEmailError, isRequired } from '../utils/validators';
import { NgIf } from '@angular/common';
import { GoogleButtonComponent } from '../../ui/google-button/google-button.component';

export interface FormSignIn{
  email: FormControl<string | null>;
  password: FormControl<string | null>;
}

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, RouterLink, GoogleButtonComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css'
})
export default class SignInComponent {
  private _formBuilder = inject(FormBuilder);
  private _authServices = inject(AuthService);
  private _router = inject(Router);

  isRequired(field: 'email' | 'password') {
    return isRequired(field, this.form)
  }

  hasEmailError() {
    return hasEmailError(this.form);
  }

  form = this._formBuilder.group<FormSignIn>({
    email: this._formBuilder.control('', [Validators.required, Validators.email]),
    password: this._formBuilder.control('', Validators.required),
  });

  async submit() {
    if(this.form.invalid) return;

    try {
      const {email, password} = this.form.value;
      if(!email || !password) return;
      await this._authServices.signIn({ email, password });
      this._router.navigateByUrl('/menu');
      
    } catch (error) {

    }
  }

  async submitWithGoogle() {
    try {
      await this._authServices.signInWithGoogle();
      this._router.navigateByUrl('/menu');
    } catch (error) {
    }
  }
}
  
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../data-access/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export default class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  userEmail = new FormControl('');

  async onReset() {
    try {
      const email = this.userEmail.value;
      if (email) {  
        await this.authService.resetPassword(email);
        alert('Correo enviado');
        this.router.navigateByUrl('/sign-in');
      }
    } catch (error) {
      console.log(error);
    }
  }
}
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../account/auth/data-access/auth.service';
import { AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import {
  updateEmail,
  updatePassword,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider
} from '@angular/fire/auth';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { Router } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonInput, IonItem, IonLabel, IonSpinner, IonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-change-pws-email',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, BackIconComponent, IonContent, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonText, IonSpinner ],
  templateUrl: './change-pws-email.component.html',
  styleUrls: ['./change-pws-email.component.scss']
})
export default class ChangePwsEmailComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private alertController = inject(AlertController);
  private _router = inject(Router);

  emailLoading = false;
  passwordLoading = false;

  navigateTo() {
    this._router.navigateByUrl('/menu/configuraciones');
  }

  async showAlert(message: string) {
    const alert = await this.alertController.create({
      message,
      buttons: ['OK']
    });

    await alert.present();
  }

  emailForm = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', Validators.required]
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  // change-pws-email.component.ts
  async onEmailChange() {
    if (this.emailLoading || this.emailForm.invalid) return;

    this.emailLoading = true;
    try {
      const newEmail = this.emailForm.get('newEmail')?.value;
      const currentPassword = this.emailForm.get('currentPassword')?.value;

      if (!newEmail || !currentPassword) {
        throw new Error('Por favor, completa todos los campos');
      }

      // Primero reautenticamos al usuario
      await this.authService.reauthenticateUser(currentPassword);

      // Iniciamos el proceso de verificación del nuevo email
      await this.authService.initiateEmailUpdate(newEmail);
      await this.showAlert('Se ha enviado un correo de verificación a la nueva dirección. Por favor, verifica tu nuevo correo para completar el cambio.');
      this.emailForm.reset();
    } catch (error: any) {
      console.error('Error al cambiar email:', error);
      let errorMessage = 'Error al cambiar el correo';

      switch (error.code) {
        case 'auth/requires-recent-login':
          await this.showAlert('Por favor, vuelve a iniciar sesión e intenta nuevamente');
          break;
        case 'auth/invalid-credential':
          await this.showAlert('La contraseña actual es incorrecta');
          break;
        case 'auth/email-already-in-use':
          await this.showAlert('Este correo electrónico ya está en uso');
          break;
        case 'auth/invalid-email':
          await this.showAlert('El correo electrónico no es válido');
          break;
        case 'auth/operation-not-allowed':
          await this.showAlert('Esta operación no está permitida en este momento');
          break;
      }

      alert(errorMessage);
    } finally {
      this.emailLoading = false;
    }
  }

  async onPasswordChange() {

    if (this.passwordLoading || this.passwordForm.invalid) return;

    this.passwordLoading = true;
    try {
      const currentPassword = this.passwordForm.get('currentPassword')?.value;
      const newPassword = this.passwordForm.get('newPassword')?.value;
      const user = this.authService.currentUser;

      if (currentPassword && newPassword && user?.email && user) {
        // Reautenticar usuario
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Actualizar contraseña
        await updatePassword(user, newPassword);
        await this.showAlert('Contraseña actualizada exitosamente');
        this.passwordForm.reset();
      }
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      await this.showAlert('Error al cambiar la contraseña');
    } finally {
      this.passwordLoading = false;
    }
  }

  async onForgotPassword() {
    try {
      const user = this.authService.currentUser;
      if (user?.email) {
        await this.authService.resetPassword(user.email);
        await this.showAlert('Se ha enviado un correo para restablecer tu contraseña');
      }
    } catch (error: any) {
      console.error('Error al enviar correo de recuperación:', error);
      await this.showAlert('Error al enviar el correo de recuperación');
    }
  }
}
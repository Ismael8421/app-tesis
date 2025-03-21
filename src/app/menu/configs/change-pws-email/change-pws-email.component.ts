import { Component, OnInit, inject } from '@angular/core';
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
import { 
  IonButton, 
  IonCard, 
  IonCardContent, 
  IonCardHeader, 
  IonCardTitle, 
  IonContent, 
  IonInput, 
  IonItem, 
  IonLabel, 
  IonSpinner, 
  IonText 
} from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../settings/data-access/theme.service';

@Component({
  selector: 'app-change-pws-email',
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    CommonModule, 
    BackIconComponent, 
    IonContent, 
    IonButton, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent, 
    IonItem, 
    IonLabel, 
    IonInput, 
    IonText, 
    IonSpinner
  ],
  templateUrl: './change-pws-email.component.html',
  styleUrls: ['./change-pws-email.component.scss']
})
export default class ChangePwsEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private alertController = inject(AlertController);
  private _router = inject(Router);
  private _themeService = inject(ThemeService);

  isEmailProvider = false;
  emailLoading = false;
  passwordLoading = false;
  isDarkMode = false;

  constructor() {
    // Suscribirse a los cambios del tema
    this._themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateDarkModeStatus();
      });
  }

  ngOnInit() {
    // Inicializar el estado del tema
    this.updateDarkModeStatus();
    
    // Verificar el tipo de proveedor de autenticación
    const user = this.authService.currentUser;
    if (user) {
      this.isEmailProvider = user.providerData.some(
        provider => provider.providerId === 'password'
      );
    }
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  emailForm = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', Validators.required]
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  navigateTo() {
    this._router.navigateByUrl('/menu/configuraciones');
  }

  async showAlert(message: string, header?: string) {
    const alert = await this.alertController.create({
      header: header || 'Información',
      message,
      buttons: ['OK'],
      cssClass: this.isDarkMode ? 'dark-alert' : 'light-alert'
    });
    await alert.present();
  }

  async onEmailChange() {
    if (this.emailLoading || this.emailForm.invalid) return;

    this.emailLoading = true;
    try {
      const newEmail = this.emailForm.get('newEmail')?.value;
      const currentPassword = this.emailForm.get('currentPassword')?.value;

      if (!newEmail || !currentPassword) {
        throw new Error('Por favor, completa todos los campos');
      }

      await this.authService.reauthenticateUser(currentPassword);
      await this.authService.initiateEmailUpdate(newEmail);
      await this.showAlert('Se ha enviado un correo de verificación a la nueva dirección. Por favor, verifica tu nuevo correo para completar el cambio.', 'Verificación enviada');
      this.emailForm.reset();
    } catch (error: any) {
      console.error('Error al cambiar email:', error);
      let errorMessage = 'Error al cambiar el correo';
      let headerMessage = 'Error';

      switch (error.code) {
        case 'auth/requires-recent-login':
          await this.showAlert('Por favor, vuelve a iniciar sesión e intenta nuevamente', 'Autenticación requerida');
          break;
        case 'auth/invalid-credential':
          await this.showAlert('La contraseña actual es incorrecta', 'Error de autenticación');
          break;
        case 'auth/email-already-in-use':
          await this.showAlert('Este correo electrónico ya está en uso', 'Correo existente');
          break;
        case 'auth/invalid-email':
          await this.showAlert('El correo electrónico no es válido', 'Error de formato');
          break;
        case 'auth/operation-not-allowed':
          await this.showAlert('Esta operación no está permitida en este momento', 'Operación no permitida');
          break;
        default:
          await this.showAlert(errorMessage, headerMessage);
      }
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
        // Validar que la contraseña nueva sea diferente de la actual
        if (currentPassword === newPassword) {
          await this.showAlert('La nueva contraseña no puede ser igual a la actual', 'Contraseña inválida');
          this.passwordLoading = false;
          return;
        }
        
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        await this.showAlert('Contraseña actualizada exitosamente', 'Éxito');
        this.passwordForm.reset();
      }
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      let headerMessage = 'Error';
      let errorMessage = 'Error al cambiar la contraseña';
      
      switch (error.code) {
        case 'auth/requires-recent-login':
          errorMessage = 'Por favor, vuelve a iniciar sesión e intenta nuevamente';
          headerMessage = 'Autenticación requerida';
          break;
        case 'auth/wrong-password':
          errorMessage = 'La contraseña actual es incorrecta';
          headerMessage = 'Error de autenticación';
          break;
        case 'auth/weak-password':
          errorMessage = 'La nueva contraseña es demasiado débil. Usa al menos 6 caracteres.';
          headerMessage = 'Contraseña débil';
          break;
      }
      
      await this.showAlert(errorMessage, headerMessage);
    } finally {
      this.passwordLoading = false;
    }
  }

  async onForgotPassword() {
    try {
      const user = this.authService.currentUser;
      if (user?.email) {
        await this.authService.resetPassword(user.email);
        await this.showAlert('Se ha enviado un correo para restablecer tu contraseña', 'Correo enviado');
      }
    } catch (error: any) {
      console.error('Error al enviar correo de recuperación:', error);
      await this.showAlert('Error al enviar el correo de recuperación', 'Error');
    }
  }
}
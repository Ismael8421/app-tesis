import { Component, inject, OnInit, HostBinding } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../../account/shared/data-access/auth-state.service';
import { ThemeService, ThemeType } from './data-access/theme.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonAvatar,
  IonContent,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  AlertController,
  ToastController,
  IonButton
} from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProfileImageService } from '../profile/profile-image.service';
import { Auth } from '@angular/fire/auth';
import { ProfileVisibilityService } from '../../search/data-access/profile-visibility.service';
import { UserActivityService } from '../../shared/data-access/user-activity.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    CommonModule,
    FormsModule,
    IonContent,
    IonList,
    IonItem,
    IonAvatar,
    IonImg,
    IonLabel,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonButton
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private _authState = inject(AuthStateService);
  private _router = inject(Router);
  private _themeService = inject(ThemeService);
  private _profileImageService = inject(ProfileImageService);
  private _auth = inject(Auth);
  private userActivityService = inject(UserActivityService)

  currentTheme!: ThemeType;
  isDarkMode: boolean = false;
  profileImageUrl: string | null = null;
  isInGroup: boolean = false;

  themeOptions: { value: ThemeType; label: string }[] = [
    { value: 'system', label: 'Igual que el sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' }
  ];

  constructor(
    private profileVisibilityService: ProfileVisibilityService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    // Constructor - suscribirse al estado
    this.profileVisibilityService.getProfileStatus()
      .pipe(takeUntilDestroyed())
      .subscribe(status => {
        this.isInGroup = status.visibility === 'visible_in_group';
      });
    // Suscribirse a los cambios del tema usando takeUntilDestroyed
    this._themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(theme => {
        this.currentTheme = theme;
        this.updateDarkModeStatus();
      });
  }

  currentVisibility: 'visible' | 'visible_in_group' | 'invisible' = 'visible';

  async ngOnInit() {
    // Inicializar el tema actual
    this.currentTheme = this._themeService.getCurrentTheme();
    // Determinar si estamos en modo oscuro
    this.updateDarkModeStatus();

    // Cargar la imagen de perfil
    await this.loadProfileImage();
  }

  // Método para cargar la imagen de perfil
  async loadProfileImage() {
    try {
      const currentUser = this._auth.currentUser;
      if (currentUser) {
        const imageUrl = await this._profileImageService.getProfileImage(currentUser.uid);
        this.profileImageUrl = imageUrl;
      }
    } catch (error) {
      console.error('Error al cargar imagen de perfil:', error);
    }
  }

  // Manejar errores de carga de imagen
  handleImageError() {
    this.profileImageUrl = 'icons/logo_tesis.png';
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  navigateTo() {
    this._router.navigateByUrl('/menu/perfil');
  }

  navigateToCPE() {
    this._router.navigateByUrl('/menu/chagePwsEmail');
  }

  navigateToReport() {
    this._router.navigateByUrl('/menu/report');
  }

  async logOut() {
    await this._authState.logOut();
    this._router.navigateByUrl('/auth/sign-in');
  }

  onThemeChange(event: CustomEvent) {
    const newTheme = event.detail.value as ThemeType;
    this._themeService.setTheme(newTheme);
  }

  async onVisibilityChange(event: CustomEvent) {
    const newVisibility = event.detail.value;
    try {
      await this.profileVisibilityService.changeVisibility(newVisibility);
    } catch (error) {
      console.error('Error al cambiar visibilidad:', error);
      // Mostrar mensaje de error
    }
  }

  async showVisibilityInfo() {
    const alert = await this.alertController.create({
      header: 'Visibilidad del perfil',
      message: `
        <p><strong>Visible para todos:</strong> Tu perfil aparecerá en las recomendaciones para todos los usuarios.</p>
        <p><strong>Visible (en grupo):</strong> Tu perfil aparecerá indicando que ya estás en un grupo de trabajo.</p>
        <p><strong>Invisible:</strong> Tu perfil no aparecerá en las recomendaciones para otros usuarios.</p>
      `,
      buttons: ['Entendido']
    });
  
    await alert.present();
  }

  setupInactivityTest() {
    this.userActivityService.forceActivityCheck().then(() => {
      alert('Registro de actividad configurado para hace 4 minutos. Cierra la app y espera aproximadamente 1-2 minutos para recibir el recordatorio.');
    });
  }

  testDirectly() {
    this.userActivityService.testInactivityDirectly().then(() => {
      alert('Prueba directa iniciada. Verifica las notificaciones y el diálogo.');
    });
  }
}
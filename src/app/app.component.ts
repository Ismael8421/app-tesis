import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';
import { UserStatusService } from './menu/chats/data-access/userstatus.service';
import { Auth, getRedirectResult } from '@angular/fire/auth';
import { Platform } from '@ionic/angular';
import { AuthService } from './account/auth/data-access/auth.service';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private platform = inject(Platform);
  private userStatusService = inject(UserStatusService);

  constructor(
    private themeService: ThemeService,
    private auth: Auth,
    private authService: AuthService
  ) {
    // Asegurarnos de que el tema se inicialice
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setTheme(savedTheme as 'system' | 'dark' | 'light');
    }
    
    // Añadir listener para cambios de estado de autenticación
    FirebaseAuthentication.addListener('authStateChange', (change) => {
      console.log('Auth state changed', change);
      if (change.user) {
        // El usuario ha iniciado sesión, inicializar servicios de notificaciones
        this.initNotifications();
      }
    });
  }

  async ngOnInit() {
    // Verificar si hay un resultado de redirección al iniciar la app
    const result = await this.authService.getRedirectResult();
    if (result?.user) {
      // El usuario ha iniciado sesión exitosamente después de una redirección
      console.log('Usuario autenticado:', result.user);
      // Inicializar servicios después de la autenticación
      this.initNotifications();
    } else if (this.auth.currentUser) {
      // El usuario ya estaba autenticado
      this.initNotifications();
    }
    
    // Verificar resultados de redirección de autenticación
    await this.checkRedirectResult();

    // Cuando la plataforma está lista, inicializar todo lo relacionado
    this.platform.ready().then(() => {
      // Esto asegura que las operaciones nativas se ejecuten una vez que la plataforma esté lista
      this.initNotifications();
    });
  }

  /**
   * Inicializa todos los servicios relacionados con notificaciones
   */
  private initNotifications() {
    if (!this.auth.currentUser) return;
    // Inicializar el estado del usuario
    this.userStatusService.refreshStatus();
  }

  /**
   * Verifica si hay resultados pendientes de la redirección de autenticación
   * Importante para el flujo de autenticación con Google en dispositivos móviles
   */
  private async checkRedirectResult() {
    try {
      const result = await getRedirectResult(this.auth);
      if (result && result.user) {
        // Usuario ha iniciado sesión correctamente mediante redirección
        this.router.navigateByUrl('/menu');
      }
    } catch (error) {
      console.error('Error al manejar redirección de autenticación:', error);
    }
  }
}
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';
import { UserStatusService } from './menu/chats/data-access/userstatus.service';
import { Auth, getRedirectResult } from '@angular/fire/auth';
import { Platform } from '@ionic/angular';
import { AuthService } from './account/auth/data-access/auth.service';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { NotificationService } from './menu/chats/data-access/notification.service';
import { UserActivityService } from './menu/shared/data-access/user-activity.service';
import { ModalController } from '@ionic/angular/standalone';

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
  private notificationService = inject(NotificationService);
  private userActivityService = inject(UserActivityService);
  private modalController = inject(ModalController);

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
        // El usuario ha iniciado sesión, inicializar servicios
        this.initServices();
      } else {
        // El usuario ha cerrado sesión, limpiar tokens
        this.notificationService.clearTokensOnLogout();
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
      this.initServices();
    } else if (this.auth.currentUser) {
      // El usuario ya estaba autenticado
      this.initServices();
    }
    
    // Verificar resultados de redirección de autenticación
    await this.checkRedirectResult();
  
    // Cuando la plataforma está lista, inicializar todo lo relacionado
    this.platform.ready().then(() => {
      // Esto asegura que las operaciones nativas se ejecuten una vez que la plataforma esté lista
      this.initServices();
    });
    this.userActivityService.registerActivity('app_start');
  }

  /**
   * Inicializa todos los servicios de la aplicación
   */
  private initServices() {
    if (!this.auth.currentUser) return;
    
    // Inicializar el estado del usuario (online/offline)
    this.userStatusService.refreshStatus();
    
    // Registrar actividad del usuario (inicio de sesión) y verificar actividad
    this.userActivityService.registerActivity('login');
    this.userActivityService.checkInactivity();
    
    // Inicializar el servicio de notificaciones
    this.initNotifications();
  }  

  /**
   * Inicializa el sistema de notificaciones
   */
  private async initNotifications() {
    try {
      // Solicitar/comprobar permisos de notificaciones
      const hasPermission = await this.notificationService.checkAndRequestPermissions();
      
      if (hasPermission) {
        console.log('Permisos de notificaciones concedidos');
        
        // Actualizar el token FCM después del login
        if (this.auth.currentUser) {
          await this.notificationService.updateTokenAfterLogin();
        }
      } else {
        console.log('Permisos de notificaciones denegados o no disponibles');
      }
    } catch (error) {
      console.error('Error inicializando notificaciones:', error);
    }
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
        
        // Inicializar notificaciones después del login
        await this.notificationService.updateTokenAfterLogin();
      }
    } catch (error) {
      console.error('Error al manejar redirección de autenticación:', error);
    }
  }
}
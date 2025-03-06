import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';
import { NotificationService } from './menu/chats/data-access/notification.service';
import { Auth, getRedirectResult } from '@angular/fire/auth';
import { Platform } from '@ionic/angular';

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

  constructor(
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private auth: Auth
  ) {
    // Asegurarnos de que el tema se inicialice
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setTheme(savedTheme as 'system' | 'dark' | 'light');
    }
  }

  ngOnInit() {
    // Comprobar si hay redirecciones pendientes al iniciar la app
    this.platform.ready().then(() => {
      this.checkRedirectResult();
    });

    // Inicializar notificaciones push cuando el usuario inicia sesión
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.notificationService.initPushNotifications();
        this.notificationService.subscribeToChats();
      }
    });
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
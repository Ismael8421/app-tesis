import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';
import { UserStatusService } from './menu/chats/data-access/userstatus.service';
import { Auth, getRedirectResult } from '@angular/fire/auth';
import { Platform, ToastController } from '@ionic/angular';
import { AuthService } from './account/auth/data-access/auth.service';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { UserActivityService } from './menu/shared/data-access/user-activity.service';
import { IonApp, IonRouterOutlet, ModalController } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { NetworkService } from './services/network.service';
import { OfflineScreenComponent } from './offline-screen/offline-screen.component';
import { CommonModule } from '@angular/common';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { getDatabase, ref, set } from 'firebase/database';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, IonApp, OfflineScreenComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private platform = inject(Platform);
  private userStatusService = inject(UserStatusService);
  private userActivityService = inject(UserActivityService);
  private modalController = inject(ModalController);
  private toastController = inject(ToastController);
  isOffline = false;
  private networkSubscription: Subscription | undefined;

  constructor(
    private themeService: ThemeService,
    private auth: Auth,
    private authService: AuthService,
    private networkService: NetworkService
  ) {
    // Inicializar tema
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setTheme(savedTheme as 'system' | 'dark' | 'light');
    }

    // Escuchar cambios de estado de autenticación
    FirebaseAuthentication.addListener('authStateChange', (change) => {
      console.log('Auth state changed', change);
      if (change.user) {
        this.initServices();
        this.initializeFCM();
      }
    });
  }

  async ngOnInit() {
    // Verificar estado inicial de la red
    this.isOffline = !this.networkService.isConnected();

    // Suscribirse a cambios en el estado de la red
    this.networkSubscription = this.networkService.getNetworkStatus().subscribe(
      isConnected => {
        this.isOffline = !isConnected;
      }
    );

    // Verificar resultado de redirección de autenticación
    const result = await this.authService.getRedirectResult();
    if (result?.user) {
      console.log('Usuario autenticado:', result.user);
      this.initServices();
      this.initializeFCM();
    } else if (this.auth.currentUser) {
      this.initServices();
      this.initializeFCM();
    }

    // Verificar resultados de redirección
    await this.checkRedirectResult();

    // Inicializar servicios específicos de la plataforma
    this.platform.ready().then(() => {
      this.initServices();
    });
    this.userActivityService.registerActivity('app_start');
  }

  private async initializeFCM() {
    if (!this.auth.currentUser) return;

    const userId = this.auth.currentUser.uid;

    if (this.platform.is('capacitor')) {
      // Android (Capacitor)
      try {
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive === 'granted') {
          const result = await FirebaseMessaging.getToken();
          const token = result.token;
          console.log('FCM Token (Android):', token);
          await this.saveFCMToken(userId, token);

          // Manejar notificaciones en primer plano
          FirebaseMessaging.addListener('notificationReceived', async (event) => {
            console.log('Notificación en primer plano:', event.notification);
            await this.showToast('Tienes un mensaje nuevo, revísalo.');
          });
        } else {
          console.log('Permisos de notificación denegados en Android');
        }
      } catch (error) {
        console.error('Error inicializando FCM en Android:', error);
      }
    } else {
      // Web
      try {
        const messaging = getMessaging();
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, { vapidKey: environment.firebase.vapidKey });
          console.log('FCM Token (Web):', token);
          await this.saveFCMToken(userId, token);

          // Manejar notificaciones en primer plano
          onMessage(messaging, async (payload) => {
            console.log('Notificación en primer plano:', payload);
            await this.showToast(payload.notification?.body || 'Tienes un mensaje nuevo, revísalo.');
          });
        } else {
          console.log('Permisos de notificación denegados en Web');
        }
      } catch (error) {
        console.error('Error inicializando FCM en Web:', error);
      }
    }
  }

  private async saveFCMToken(userId: string, token: string) {
    const db = getDatabase();
    await set(ref(db, `fcmTokens/${userId}/token`), token);
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  private initServices() {
    if (!this.auth.currentUser) return;

    // Inicializar estado del usuario
    this.userStatusService.refreshStatus();

    // Registrar actividad del usuario
    this.userActivityService.registerActivity('login');
    this.userActivityService.checkInactivity();
  }

  private async checkRedirectResult() {
    try {
      const result = await getRedirectResult(this.auth);
      if (result && result.user) {
        this.router.navigateByUrl('/menu');
      }
    } catch (error) {
      console.error('Error al manejar redirección de autenticación:', error);
    }
  }

  ngOnDestroy() {
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
    }
  }
}
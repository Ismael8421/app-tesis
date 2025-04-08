import { Injectable, OnDestroy, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Auth } from '@angular/fire/auth';
import { Database, ref, set, get, update } from '@angular/fire/database';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, from } from 'rxjs';
import { catchError, filter, switchMap, take, tap } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private auth = inject(Auth);
  private db = inject(Database);
  private platform = inject(Platform);
  private router = inject(Router);

  // Almacena los tokens FCM del dispositivo actual
  private fcmToken: string | null = null;

  // Subject para notificar cuando se completa la inicialización
  private initialized = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initialized.asObservable();

  // Subject para controlar si las notificaciones están habilitadas
  private notificationsEnabled = new BehaviorSubject<boolean>(false);
  public notificationsEnabled$ = this.notificationsEnabled.asObservable();

  // Suscripciones para limpiar en ngOnDestroy
  private subscriptions: Subscription[] = [];

  constructor() {
    // Inicializar cuando la plataforma esté lista
    this.platform.ready().then(() => {
      this.initNotifications();
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripciones al destruir el servicio
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Inicializa el sistema de notificaciones
   */
  private async initNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Notificaciones push no disponibles en entorno web');
      this.initialized.next(true);
      return;
    }

    try {
      // Registrar los listeners primero
      await this.registerNotificationListeners();

      // Solicitar permisos
      const permissionStatus = await PushNotifications.requestPermissions();
      
      if (permissionStatus.receive === 'granted') {
        // Notificar que las notificaciones están habilitadas
        this.notificationsEnabled.next(true);

        // Registrar para notificaciones push
        await PushNotifications.register();
        
        // También registrar con FirebaseMessaging para soporte completo
        await FirebaseMessaging.requestPermissions();
        
        console.log('Notificaciones push inicializadas correctamente');
      } else {
        console.log('Permiso de notificaciones denegado');
        this.notificationsEnabled.next(false);
      }
    } catch (error) {
      console.error('Error inicializando notificaciones push:', error);
    } finally {
      // Marcar como inicializado en cualquier caso
      this.initialized.next(true);
    }
  }

  /**
   * Registra los listeners para eventos de notificaciones
   */
  private async registerNotificationListeners(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Listener para cuando se registra un token
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Token de notificaciones push recibido:', token.value);
      this.fcmToken = token.value;
      
      // Si el usuario está autenticado, guardar el token
      if (this.auth.currentUser) {
        await this.saveDeviceToken(token.value);
      }
    });

    // Listener para cuando falla el registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error en registro de notificaciones push:', error);
    });

    // Listener para notificaciones recibidas mientras la app está en primer plano
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Notificación recibida en primer plano:', notification);
      // Mostrar notificación personalizada o actualizar la UI según sea necesario
      this.handleForegroundNotification(notification);
    });

    // Listener para cuando se presiona una notificación
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Acción de notificación realizada:', action);
      // Manejar navegación o acción basada en la notificación
      this.handleNotificationAction(action);
    });

    // También configurar los listeners de Firebase Messaging
    FirebaseMessaging.addListener('notificationReceived', (event) => {
      console.log('FCM notification received:', event);
    });

    FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      console.log('FCM notification action performed:', event);
      this.handleFCMNotificationAction(event);
    });

    FirebaseMessaging.addListener('tokenReceived', async (event) => {
      console.log('FCM token received:', event.token);
      this.fcmToken = event.token;
      
      // Si el usuario está autenticado, guardar el token
      if (this.auth.currentUser) {
        await this.saveDeviceToken(event.token);
      }
    });
  }

  /**
   * Guarda el token del dispositivo en Firebase para el usuario actual
   */
  private async saveDeviceToken(token: string): Promise<void> {
    if (!this.auth.currentUser) return;

    try {
      const userId = this.auth.currentUser.uid;
      const deviceId = this.getDeviceIdentifier();
      const timestamp = Date.now();

      // Guardar el token en la estructura de datos del usuario
      const tokenRef = ref(this.db, `userDevices/${userId}/${deviceId}`);
      
      await set(tokenRef, {
        token,
        platform: this.platform.is('ios') ? 'ios' : 'android',
        lastUpdated: timestamp,
        active: true
      });

      console.log('Token guardado correctamente para el usuario');
    } catch (error) {
      console.error('Error guardando token del dispositivo:', error);
    }
  }

  /**
   * Genera un identificador único para el dispositivo
   */
  private getDeviceIdentifier(): string {
    // En una implementación real, usaríamos Device de Capacitor 
    // o alguna otra forma de obtener un ID persistente
    
    // Por ahora usamos una combinación de timestamp y random para simular
    const randomId = Math.random().toString(36).substring(2, 15);
    const storedId = localStorage.getItem('device_id');
    
    if (storedId) {
      return storedId;
    }
    
    const newId = `device_${randomId}`;
    localStorage.setItem('device_id', newId);
    return newId;
  }

  /**
   * Método público para actualizar los tokens después de un login
   */
  public async updateTokenAfterLogin(): Promise<void> {
    if (!this.auth.currentUser) return;
    
    // Asegurarse de que las notificaciones estén inicializadas
    if (!this.initialized.getValue()) {
      await this.waitForInitialization();
    }
    
    if (this.fcmToken) {
      await this.saveDeviceToken(this.fcmToken);
    } else if (Capacitor.isNativePlatform()) {
      // Si no tenemos token pero estamos en una plataforma nativa, obtenerlo
      try {
        // Intentar obtener el token actual de FCM
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
          this.fcmToken = token;
          await this.saveDeviceToken(token);
        }
      } catch (error) {
        console.error('Error obteniendo token FCM:', error);
      }
    }
  }

  /**
   * Espera a que se complete la inicialización
   */
  private async waitForInitialization(): Promise<void> {
    return new Promise<void>((resolve) => {
      const sub = this.initialized$
        .pipe(
          filter(initialized => initialized),
          take(1)
        )
        .subscribe(() => {
          resolve();
          sub.unsubscribe();
        });
    });
  }

  /**
   * Maneja una notificación recibida mientras la app está en primer plano
   */
  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // Aquí puedes implementar lógica personalizada, como mostrar un toast,
    // actualizar badges, o refrescar datos
    
    // Ejemplo: Si es una notificación de mensaje, actualizar la lista de chats
    if (notification.data && notification.data.type === 'message') {
      // Si la notificación tiene un chat_id, podríamos usarlo para actualizar ese chat específico
      if (notification.data.chat_id) {
        // Emitir un evento o llamar a un servicio para actualizar el chat
        // Por ejemplo, forzar actualización en ChatService
        // this.chatService.forceRefreshChat(notification.data.chat_id);
      }
    }
    
    // Mostrar una notificación nativa aunque la app esté en primer plano (opcional)
    this.showLocalNotification(notification);
  }

  /**
   * Muestra una notificación local aunque la app esté en primer plano
   */
  private async showLocalNotification(notification: PushNotificationSchema): Promise<void> {
    try {
      // Importar LocalNotifications de Capacitor
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: new Date().getTime(),
            title: notification.title || 'Nuevo mensaje',
            body: notification.body || 'Has recibido un nuevo mensaje',
            largeBody: notification.body,
            summaryText: 'Mensaje',
            extra: notification.data
          }
        ]
      });
    } catch (error) {
      console.error('Error mostrando notificación local:', error);
    }
  }

  /**
   * Maneja la acción realizada cuando el usuario toca una notificación
   */
  private handleNotificationAction(action: ActionPerformed): void {
    // Extraer datos de la notificación
    const data = action.notification.data;
    
    // Si es una notificación de mensaje, navegar al chat
    if (data && data.type === 'message' && data.chat_id) {
      // Navegar al chat correspondiente
      this.router.navigate(['/menu/mensajes', data.chat_id]);
    }
  }

  /**
   * Maneja la acción cuando el usuario toca una notificación FCM
   */
  private handleFCMNotificationAction(event: any): void {
    // Extraer datos de la notificación
    const data = event.notification?.data;
    
    // Si es una notificación de mensaje, navegar al chat
    if (data && data.type === 'message' && data.chat_id) {
      // Navegar al chat correspondiente
      this.router.navigate(['/menu/mensajes', data.chat_id]);
    }
  }

  /**
   * Limpia los tokens del dispositivo al cerrar sesión
   */
  public async clearTokensOnLogout(): Promise<void> {
    if (!this.auth.currentUser) return;
    
    try {
      const userId = this.auth.currentUser.uid;
      const deviceId = this.getDeviceIdentifier();
      
      // Marcar el dispositivo como inactivo en lugar de eliminarlo
      const tokenRef = ref(this.db, `userDevices/${userId}/${deviceId}`);
      await update(tokenRef, {
        active: false,
        lastLogout: Date.now()
      });
      
      console.log('Token marcado como inactivo para el usuario');
    } catch (error) {
      console.error('Error limpiando token del dispositivo:', error);
    }
  }

  /**
   * Comprueba y solicita permisos de notificación
   */
  public async checkAndRequestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    
    try {
      // Verificar estado actual de permisos
      const status = await PushNotifications.checkPermissions();
      
      if (status.receive === 'granted') {
        this.notificationsEnabled.next(true);
        return true;
      }
      
      // Solicitar permisos si no están concedidos
      const requestStatus = await PushNotifications.requestPermissions();
      const permissionGranted = requestStatus.receive === 'granted';
      
      this.notificationsEnabled.next(permissionGranted);
      
      if (permissionGranted) {
        // Registrar para recibir notificaciones
        await PushNotifications.register();
        
        // También registrar con FirebaseMessaging
        await FirebaseMessaging.requestPermissions();
      }
      
      return permissionGranted;
    } catch (error) {
      console.error('Error verificando/solicitando permisos de notificación:', error);
      return false;
    }
  }

  /**
   * Configura tópicos para notificaciones (opcional, para futuras expansiones)
   */
  public async subscribeToTopic(topic: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await FirebaseMessaging.subscribeToTopic({ topic });
      console.log(`Suscrito al tópico: ${topic}`);
    } catch (error) {
      console.error(`Error suscribiéndose al tópico ${topic}:`, error);
    }
  }

  /**
   * Cancela suscripción a un tópico
   */
  public async unsubscribeFromTopic(topic: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await FirebaseMessaging.unsubscribeFromTopic({ topic });
      console.log(`Desuscrito del tópico: ${topic}`);
    } catch (error) {
      console.error(`Error desuscribiéndose del tópico ${topic}:`, error);
    }
  }

  /**
   * Obtiene los tokens de dispositivo para un usuario específico
   */
  public getDeviceTokens(userId: string): Observable<Array<{token: string, platform: string}>> {
    return from(get(ref(this.db, `userDevices/${userId}`))).pipe(
      map(snapshot => {
        if (!snapshot.exists()) return [];
        
        const devices = snapshot.val();
        const tokens: Array<{token: string, platform: string}> = [];
        
        Object.values(devices).forEach((device: any) => {
          if (device.active && device.token) {
            tokens.push({
              token: device.token,
              platform: device.platform || 'android'
            });
          }
        });
        
        return tokens;
      }),
      catchError(error => {
        console.error('Error obteniendo tokens de dispositivo:', error);
        return [];
      })
    );
  }

  /**
   * Observable para seguir el estado de autorización de notificaciones
   */
  public getNotificationPermissionState(): Observable<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return of(false);
    }
    
    return from(PushNotifications.checkPermissions()).pipe(
      map(status => status.receive === 'granted'),
      catchError(error => {
        console.error('Error comprobando permisos de notificación:', error);
        return of(false);
      })
    );
  }

  private async createNotificationChannels(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.platform.is('android')) {
      return;
    }
  
    try {
      // Importar LocalNotifications bajo demanda
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Crear canal para mensajes
      await LocalNotifications.createChannel({
        id: 'messages',
        name: 'Mensajes',
        description: 'Notificaciones de mensajes nuevos',
        importance: 4, // HIGH
        visibility: 1, // PUBLIC
        sound: 'notification_sound',
        vibration: true,
        lights: true
      });
      
      console.log('Canal de notificaciones creado correctamente');
    } catch (error) {
      console.error('Error creando canal de notificaciones:', error);
    }
  }
}
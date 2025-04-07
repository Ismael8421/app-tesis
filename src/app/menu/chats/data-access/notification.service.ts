import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database, ref, set, push, get } from '@angular/fire/database';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// Declaración de tipos para OneSignal (versión 5.2.11)
declare const OneSignal: {
  initialize(appId: string): void;
  getDeviceState(): Promise<DeviceState | null>;
  Notifications: {
    requestPermission(fallbackToSettings?: boolean): Promise<boolean>;
    addEventListener(
      event: 'foregroundWillDisplay',
      listener: (event: { notification: Notification; preventDefault(): void }) => void
    ): void;
    addEventListener(
      event: 'click',
      listener: (event: { notification: Notification }) => void
    ): void;
    addEventListener(
      event: 'subscriptionChange',
      listener: (event: { userId: string | null }) => void
    ): void;
  };
};

interface DeviceState {
  userId: string | null;
  hasNotificationPermission: boolean;
}

interface Notification {
  title: string;
  body: string;
  additionalData: any;
  display(): void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly ONESIGNAL_APP_ID = '1d2c69ba-1093-4b48-85a9-66d6ad9cbd78';
  private readonly ONESIGNAL_REST_API_KEY = 'os_v2_app_duwgtoqqsnfurbnjm3lk3hf5pb4t5eycowlubxnnsjjou4frwwan6xkfmqzwdfmc5bbcnwrjn5whg4zquaesmabe4z3adgbeyaylfgq';
  private initialized = false;

  constructor(
    private platform: Platform,
    private router: Router,
    private auth: Auth,
    private db: Database,
    private http: HttpClient
  ) {}

  async initOneSignal(): Promise<void> {
    if (this.initialized) return;

    if (this.platform.is('android')) {
      await this.createNotificationChannels();
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('OneSignal solo funciona en plataformas nativas');
      return;
    }

    try {
      await this.platform.ready();

      // Inicializar OneSignal
      OneSignal.initialize(this.ONESIGNAL_APP_ID);

      // Configurar manejadores
      await this.setupNotificationHandlers();

      // Solicitar permisos
      const permissionGranted = await OneSignal.Notifications.requestPermission(true);
      console.log(permissionGranted ? 'Permiso concedido' : 'Permiso denegado');

      // Obtener el Player ID
      const deviceState = await OneSignal.getDeviceState();
      if (deviceState?.userId) {
        await this.savePlayerIdToDatabase(deviceState.userId);
      }

      // Escuchar cambios en la suscripción
      OneSignal.Notifications.addEventListener('subscriptionChange', async (event) => {
        if (event.userId) {
          await this.savePlayerIdToDatabase(event.userId);
        }
      });

      this.initialized = true;
      console.log('OneSignal inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar OneSignal:', error);
    }
  }

  private async setupNotificationHandlers(): Promise<void> {
    // Notificación en primer plano
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log('Notificación recibida en primer plano');
      const notification = event.notification;

      const additionalData = notification.additionalData as any;
      if (additionalData?.chatId) {
        const chatId = additionalData.chatId;
        const currentUrl = this.router.url;

        if (currentUrl.includes(`/menu/mensajes/${chatId}`)) {
          event.preventDefault();
          return;
        }
      }

      notification.display();
    });

    // Notificación abierta
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('Notificación abierta');
      const notification = event.notification;
      const additionalData = notification.additionalData as any;

      if (additionalData?.chatId) {
        const chatId = additionalData.chatId;
        this.router.navigate(['/menu/mensajes', chatId]);
      }
    });
  }

  private async savePlayerIdToDatabase(playerId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const deviceTokenRef = ref(this.db, `deviceTokens/${user.uid}`);
      const deviceInfo = {
        playerId,
        platform: this.platform.is('ios') ? 'ios' : 'android',
        lastUpdated: new Date().toISOString(),
        userId: user.uid
      };

      await set(deviceTokenRef, deviceInfo);
      console.log('OneSignal Player ID guardado:', playerId);
    } catch (error) {
      console.error('Error guardando Player ID:', error);
    }
  }

  async sendNewMessageNotification(chatId: string, senderId: string, message: string): Promise<void> {
    try {
      if (!this.auth.currentUser) return;

      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);

      if (!chatSnapshot.exists()) return;

      const chat = chatSnapshot.val();
      const recipients = chat.participants.filter((participantId: string) => participantId !== senderId);

      for (const recipientId of recipients) {
        const userStatusRef = ref(this.db, `userStatus/${recipientId}`);
        const userStatusSnapshot = await get(userStatusRef);
        const userIsOnline =
          userStatusSnapshot.exists() &&
          userStatusSnapshot.val().status === 'online' &&
          userStatusSnapshot.val().currentChatId === chatId;

        if (userIsOnline) {
          console.log(`Usuario ${recipientId} está activo en este chat, omitiendo notificación`);
          continue;
        }

        const tokenRef = ref(this.db, `deviceTokens/${recipientId}`);
        const tokenSnapshot = await get(tokenRef);

        if (!tokenSnapshot.exists()) {
          console.log(`No se encontró Player ID para ${recipientId}`);
          continue;
        }

        const tokenData = tokenSnapshot.val();
        const playerId = tokenData.playerId;

        if (!playerId) {
          console.log(`Player ID inválido para ${recipientId}`);
          continue;
        }

        const senderDataRef = ref(this.db, `usuarios/${senderId}`);
        const senderSnapshot = await get(senderDataRef);
        let senderName = 'Usuario';

        if (senderSnapshot.exists()) {
          const userData = senderSnapshot.val();
          senderName = userData.nombreUsuario || `${userData.nombre || ''} ${userData.apellido || ''}`.trim();
        }

        // Enviar notificación directamente a OneSignal desde el cliente
        await this.sendDirectOneSignalNotification(
          playerId,
          senderName,
          message.length > 100 ? message.substring(0, 97) + '...' : message,
          chatId,
          senderId
        );

        console.log(`Notificación enviada a ${recipientId}`);
      }
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }
  }

  // Método para enviar notificación directamente a OneSignal desde el cliente
  private async sendDirectOneSignalNotification(
    recipientPlayerId: string,
    title: string,
    body: string,
    chatId: string,
    senderId: string
  ): Promise<any> {
    try {
      // Construir el payload para OneSignal
      const oneSignalPayload = {
        app_id: this.ONESIGNAL_APP_ID,
        include_player_ids: [recipientPlayerId],
        headings: { en: title },
        contents: { en: body },
        data: {
          chatId: chatId,
          senderId: senderId,
          type: 'newMessage'
        },
        android_channel_id: "chat_messages",
        ios_sound: "notification.wav",
        android_sound: "notification"
      };

      // Llamada a OneSignal REST API desde el cliente
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.ONESIGNAL_REST_API_KEY}`
      });

      return this.http.post('https://onesignal.com/api/v1/notifications', oneSignalPayload, { headers }).toPromise();
    } catch (error) {
      console.error('Error al enviar notificación a OneSignal:', error);
      throw error;
    }
  }

  private async createNotificationChannels(): Promise<void> {
    if (!this.platform.is('android')) return;

    try {
      console.log('Los canales de notificación se configuran automáticamente con OneSignal');
    } catch (error) {
      console.error('Error al configurar canales:', error);
    }
  }
}
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { ChatService } from './chat.service';
import { Database, ref, set, onValue, get } from '@angular/fire/database';
import { App } from '@capacitor/app';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  
  constructor(
    private router: Router,
    private auth: Auth,
    private chatService: ChatService,
    private db: Database,
    private platform: Platform
  ) {}

  async initPushNotifications() {
    // Solo inicializar en dispositivos nativos
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    if (!Capacitor.isPluginAvailable('PushNotifications')) {
      console.log('Push notifications not available on this device/platform');
      return;
    }

    try {
      // Solicitar permisos para notificaciones
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== 'granted') {
        console.log('Push notification permission was denied');
        return;
      }

      // Registrar para recibir notificaciones push
      await PushNotifications.register();

      // Escuchar el evento de registro (obtención de token FCM)
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM token:', token.value);
        await this.saveDeviceToken(token.value);
      });

      // Escuchar cuando llegan notificaciones mientras la app está activa
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Notification received:', notification);
        
        // Si estamos en la app pero no en el chat específico, podríamos mostrar una alerta interna
        if (notification.data && notification.data.chatId) {
          const chatId = notification.data.chatId as string;
          
          // Verificar si estamos ya en ese chat para no mostrar notificación redundante
          const currentUrl = this.router.url;
          if (!currentUrl.includes(`/menu/mensajes/${chatId}`)) {
            // Aquí podrías mostrar una notificación interna o alerta
            console.log('Nuevo mensaje en chat no abierto');
          }
        }
      });

      // Escuchar cuando el usuario toca una notificación (app en segundo plano o cerrada)
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Notification action performed:', notification);
        
        // Extraer el chatId de los datos de la notificación
        const data = notification.notification.data;
        if (data && data.chatId) {
          // Navegar al chat correspondiente
          this.router.navigate(['/menu/mensajes', data.chatId]);
        }
      });

      // Manejar apertura de la app desde una notificación
      App.addListener('appUrlOpen', (data) => {
        console.log('App opened from URL:', data);
        const slug = data.url.split('/').pop();
        if (slug && slug.includes('chat')) {
          const chatId = slug.split('=').pop();
          if (chatId) {
            this.router.navigate(['/menu/mensajes', chatId]);
          }
        }
      });

      console.log('Push notifications initialized successfully');
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  // Configurar canales de notificación para Android
  async setupNotificationChannels() {
    // Sólo aplicable para Android 8.0+
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      // Verificar si la API está disponible
      if (!Capacitor.isPluginAvailable('LocalNotifications')) {
        console.log('LocalNotifications no está disponible');
        return;
      }

      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Crear canal para mensajes de chat
      await LocalNotifications.createChannel({
        id: 'chat_messages',
        name: 'Mensajes de Chat',
        description: 'Notificaciones para nuevos mensajes de chat',
        importance: 5, // HIGH
        vibration: true,
        visibility: 1, // PUBLIC
        lights: true,
        lightColor: '#4CAF50'
      });

      console.log('Notification channels created successfully');
    } catch (error) {
      console.error('Error setting up notification channels:', error);
    }
  }

  // Guardar el token del dispositivo en Firebase para enviar notificaciones más tarde
  async saveDeviceToken(token: string) {
    const user = this.auth.currentUser;
    if (!user) return;
    
    try {
      const deviceTokenRef = ref(this.db, `deviceTokens/${user.uid}`);
      
      // Guardar información adicional sobre el dispositivo
      const deviceInfo = {
        token: token,
        platform: this.platform.is('ios') ? 'ios' : 'android',
        lastUpdated: new Date().toISOString(),
        userId: user.uid
      };
      
      await set(deviceTokenRef, deviceInfo);
      console.log('Device token saved successfully');
    } catch (error) {
      console.error('Error saving device token:', error);
    }
  }

  // Suscribirse a los chats para enviar notificaciones cuando hay nuevos mensajes
  subscribeToChats() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Obtener todos los chats del usuario y escuchar cambios
    const userChatsRef = ref(this.db, `userChats/${user.uid}`);
    onValue(userChatsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const chats = snapshot.val();
      
      // Para cada chat, escuchar nuevos mensajes
      for (const chatId in chats) {
        this.subscribeToMessages(chatId, user.uid);
      }
    });
  }

  // Escuchar nuevos mensajes en un chat específico
  private subscribeToMessages(chatId: string, userId: string) {
    const messagesRef = ref(this.db, `messages/${chatId}`);
    
    // Utilizar onValue para escuchar cambios en tiempo real
    onValue(messagesRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      
      // Obtener el chat para verificar participantes
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) return;
      
      const chat = chatSnapshot.val();
      
      // Verificar si hay mensajes no leídos para este usuario
      if (chat.unreadMessages && chat.unreadMessages[userId]) {
        // Obtener el último mensaje del chat
        const messages = snapshot.val();
        const messageKeys = Object.keys(messages);
        const lastMessageKey = messageKeys[messageKeys.length - 1];
        const lastMessage = messages[lastMessageKey];
        
        // Solo enviar notificación si el mensaje no fue enviado por el usuario actual
        if (lastMessage && lastMessage.senderId !== userId) {
          console.log('Hay un mensaje nuevo no leído');
        }
      }
    });
  }
}
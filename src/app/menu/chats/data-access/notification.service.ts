import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { ChatService } from './chat.service';
import { Database, ref, set, onValue, get } from '@angular/fire/database';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  
  constructor(
    private router: Router,
    private auth: Auth,
    private chatService: ChatService,
    private db: Database
  ) {}

  async initPushNotifications() {
    if (!Capacitor.isPluginAvailable('PushNotifications')) {
      console.log('Push notifications not available on this device/platform');
      return;
    }

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
      // Puedes mostrar una notificación interna si lo deseas
    });

    // Escuchar cuando el usuario toca una notificación (app en segundo plano)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Notification action performed:', notification);
      
      // Extraer el chatId de los datos de la notificación
      const data = notification.notification.data;
      if (data && data.chatId) {
        // Navegar al chat correspondiente
        this.router.navigate(['/menu/mensajes', data.chatId]);
      }
    });
  }

  // Guardar el token del dispositivo en Firebase para enviar notificaciones más tarde
  async saveDeviceToken(token: string) {
    const user = this.auth.currentUser;
    if (!user) return;
    
    try {
      const deviceTokenRef = ref(this.db, `deviceTokens/${user.uid}`);
      await set(deviceTokenRef, token);
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
          // Aquí no enviamos notificaciones directamente, 
          // ya que eso lo hace el servidor a través de Firebase Cloud Messaging
        }
      }
    });
  }
}
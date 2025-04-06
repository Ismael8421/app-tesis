import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BackgroundRunner } from '@capacitor/background-runner';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { ChatService } from './chat.service';
import { Database, ref, set, onValue, get } from '@angular/fire/database';
import { App } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { NetworkService } from './network.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // Controlar el estado de permisos
  private hasNotificationPermission = new BehaviorSubject<boolean>(false);
  
  // Almacena los IDs de los últimos mensajes procesados para evitar duplicados
  private lastProcessedMessages: {[chatId: string]: string} = {};
  
  constructor(
    private router: Router,
    private auth: Auth,
    private chatService: ChatService,
    private db: Database,
    private platform: Platform,
    private networkService: NetworkService
  ) {}

  /**
   * Inicializa las notificaciones locales
   */
  async initPushNotifications() {
    // Solo inicializar en dispositivos nativos
    if (!Capacitor.isNativePlatform()) {
      console.log('Las notificaciones solo funcionan en plataformas nativas');
      return;
    }

    try {
      // Verificar si el plugin está disponible
      if (!Capacitor.isPluginAvailable('LocalNotifications')) {
        console.log('LocalNotifications no está disponible en este dispositivo/plataforma');
        return;
      }

      // Solicitar permisos para notificaciones
      const permResult = await LocalNotifications.requestPermissions();
      const hasPermission = permResult.display === 'granted';
      
      this.hasNotificationPermission.next(hasPermission);
      
      if (!hasPermission) {
        console.log('Permiso de notificación denegado');
        return;
      }
      
      console.log('Permiso de notificación concedido');
      
      // BackgroundRunner se configura de otra manera, no con addListener
      // Verificaremos los mensajes no leídos en el evento de 'appStateChange'
      
      // Configurar el manejo de notificaciones cuando se tocan
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        console.log('Notificación tocada:', notification);
        
        // Extraer el chatId de los datos de la notificación
        const extraData = notification.notification.extra;
        if (extraData && extraData.chatId) {
          // Navegar al chat correspondiente
          this.router.navigate(['/menu/mensajes', extraData.chatId]);
        }
      });

      // Configurar el manejo de apertura de app desde notificación
      App.addListener('appUrlOpen', (data) => {
        console.log('App abierta desde URL:', data);
        const slug = data.url.split('/').pop();
        if (slug && slug.includes('chat')) {
          const chatId = slug.split('=').pop();
          if (chatId) {
            this.router.navigate(['/menu/mensajes', chatId]);
          }
        }
      });
      
      // Configurar monitoreo de estado de la app
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // App en primer plano
          console.log('App en primer plano');
        } else {
          // App en segundo plano, verificar mensajes nuevos periódicamente
          console.log('App en segundo plano');
          this.setupBackgroundChecks();
        }
      });

      console.log('Notificaciones locales inicializadas correctamente');
      
      // Iniciar la suscripción a chats para monitorizarlos
      this.subscribeToChats();
      
    } catch (error) {
      console.error('Error inicializando notificaciones locales:', error);
    }
  }

  /**
   * Configura canales de notificación para Android
   */
  async setupNotificationChannels() {
    // Sólo aplicable para Android
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      await LocalNotifications.createChannel({
        id: 'chat_messages',
        name: 'Mensajes de Chat',
        description: 'Notificaciones para nuevos mensajes de chat',
        importance: 5, // HIGH
        visibility: 1, // PUBLIC
        lights: true,
        lightColor: '#4CAF50',
        vibration: true
      });

      console.log('Canales de notificación creados correctamente');
    } catch (error) {
      console.error('Error configurando canales de notificación:', error);
    }
  }

  /**
   * Suscribe al servicio para escuchar cambios en los chats del usuario
   */
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

  /**
   * Escucha los nuevos mensajes en un chat específico
   */
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
        
        // Verificar si ya procesamos este mensaje
        if (this.lastProcessedMessages[chatId] === lastMessageKey) {
          return;
        }
        
        // Actualizar el último mensaje procesado
        this.lastProcessedMessages[chatId] = lastMessageKey;
        
        // Solo enviar notificación si el mensaje no fue enviado por el usuario actual
        if (lastMessage && lastMessage.senderId !== userId) {
          // Obtener datos del remitente
          const otherUserId = lastMessage.senderId;
          let senderName = lastMessage.senderName || 'Usuario';
          
          // Si la app está en segundo plano, enviar una notificación local
          this.checkAppStateAndNotify(senderName, lastMessage.content, chatId);
        }
      }
    });
  }
  
  /**
   * Verifica el estado de la app y notifica si es necesario
   */
  private async checkAppStateAndNotify(sender: string, message: string, chatId: string) {
    try {
      // Verificar si la app está activa
      const appState = await App.getState();
      const isInForeground = appState.isActive;
      
      // Si la app está en segundo plano o si no estamos en el chat específico
      if (!isInForeground) {
        this.sendLocalNotification(sender, message, chatId);
      } else {
        // La app está en primer plano, verificar si estamos en el chat específico
        const currentUrl = this.router.url;
        if (!currentUrl.includes(`/menu/mensajes/${chatId}`)) {
          // Estamos en otra pantalla, mostrar notificación en la app
          this.sendLocalNotification(sender, message, chatId);
        }
      }
    } catch (error) {
      console.error('Error verificando estado de la app:', error);
    }
  }
  
  /**
   * Envía una notificación local
   */
  private async sendLocalNotification(title: string, body: string, chatId: string) {
    if (!this.hasNotificationPermission.value) {
      console.log('No hay permiso para enviar notificaciones');
      return;
    }
    
    try {
      const notificationId = new Date().getTime();
      
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body.length > 100 ? body.substring(0, 97) + '...' : body,
            id: notificationId,
            sound: 'default',
            attachments: [],
            actionTypeId: '',
            extra: {
              chatId: chatId
            },
            channelId: 'chat_messages'
          }
        ]
      });
      
      console.log('Notificación local enviada correctamente');
    } catch (error) {
      console.error('Error enviando notificación local:', error);
    }
  }
  
  /**
   * Configura verificaciones periódicas en segundo plano
   */
  private async setupBackgroundChecks() {
    if (!this.networkService.isOnline() || !this.auth.currentUser) {
      console.log('Sin conexión o usuario no autenticado, no se iniciarán verificaciones');
      return;
    }
    
    try {
      const userId = this.auth.currentUser.uid;
      
      // Programar una notificación local que se dispare periódicamente
      // para recordar al usuario que revise sus mensajes
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Recordatorio de mensajes',
            body: 'Puedes tener mensajes no leídos',
            id: 999,
            schedule: { 
              repeats: true,
              every: 'hour' 
            },
            sound: "default",
            attachments: [],
            actionTypeId: '',
            extra: {
              checkMessages: true
            }
          }
        ]
      });
      
      console.log('Recordatorio periódico configurado');
    } catch (error) {
      console.error('Error configurando recordatorio periódico:', error);
    }
  }
  
  /**
   * Verifica si hay nuevos mensajes para el usuario
   */
  private async checkForNewMessages(userId: string) {
    try {
      if (!userId) return;
      
      const userChatsRef = ref(this.db, `userChats/${userId}`);
      const snapshot = await get(userChatsRef);
      
      if (!snapshot.exists()) return;
      
      const chats = snapshot.val();
      
      for (const chatId in chats) {
        const chatRef = ref(this.db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        
        if (!chatSnapshot.exists()) continue;
        
        const chat = chatSnapshot.val();
        
        // Verificar si hay mensajes no leídos
        if (chat.unreadMessages && chat.unreadMessages[userId]) {
          // Hay mensajes no leídos, obtener el último mensaje
          const messagesRef = ref(this.db, `messages/${chatId}`);
          const messagesSnapshot = await get(messagesRef);
          
          if (!messagesSnapshot.exists()) continue;
          
          const messages = messagesSnapshot.val();
          const messageKeys = Object.keys(messages);
          const lastMessageKey = messageKeys[messageKeys.length - 1];
          const lastMessage = messages[lastMessageKey];
          
          // Verificar si ya procesamos este mensaje
          if (this.lastProcessedMessages[chatId] === lastMessageKey) {
            continue;
          }
          
          // Actualizar el último mensaje procesado
          this.lastProcessedMessages[chatId] = lastMessageKey;
          
          // Solo notificar si el mensaje no fue enviado por el usuario actual
          if (lastMessage && lastMessage.senderId !== userId) {
            // Obtener datos del remitente
            const otherUserId = lastMessage.senderId;
            let senderName = lastMessage.senderName || 'Usuario';
            
            // Enviar notificación
            this.sendLocalNotification(senderName, lastMessage.content, chatId);
          }
        }
      }
    } catch (error) {
      console.error('Error verificando nuevos mensajes:', error);
    }
  }
}
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Channel, Importance, Visibility } from '@capacitor/local-notifications';
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
  public permissionStatus$ = this.hasNotificationPermission.asObservable();
  
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
    console.log('Inicializando sistema de notificaciones...');
    
    // Solo inicializar en dispositivos nativos
    if (!Capacitor.isNativePlatform()) {
      console.log('Las notificaciones solo funcionan en plataformas nativas');
      return;
    }

    try {
      // Verificar si el plugin está disponible
      if (!Capacitor.isPluginAvailable('LocalNotifications')) {
        console.error('LocalNotifications no está disponible en este dispositivo/plataforma');
        return;
      }

      // Configurar canales de notificación primero
      await this.setupNotificationChannels();

      // Solicitar permisos para notificaciones
      console.log('Solicitando permisos de notificación...');
      const permResult = await LocalNotifications.requestPermissions();
      console.log('Resultado de permisos:', permResult);
      
      const hasPermission = permResult.display === 'granted';
      this.hasNotificationPermission.next(hasPermission);
      
      console.log('Permiso de notificación concedido:', hasPermission);
      
      if (!hasPermission) {
        console.error('Permiso de notificación denegado');
        return;
      }
      
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
        console.log('Estado de app cambió a:', isActive ? 'Primer plano' : 'Segundo plano');
        
        if (isActive) {
          // App en primer plano
          console.log('App en primer plano - detener verificaciones en segundo plano');
        } else {
          // App en segundo plano, configurar verificaciones periódicas
          console.log('App en segundo plano - iniciar verificaciones periódicas');
          this.setupBackgroundChecks();
        }
      });

      console.log('Notificaciones locales inicializadas correctamente');
      
      // Iniciar la suscripción a chats para monitorizarlos
      await this.subscribeToChats();
      
      // Ejecutar prueba de notificación después de inicializar
      if (hasPermission) {
        setTimeout(() => {
          this.testLocalNotification();
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error inicializando notificaciones locales:', error);
      console.error('Detalles del error:', JSON.stringify(error));
    }
  }

  /**
   * Configura canales de notificación para Android
   */
  async setupNotificationChannels() {
    console.log('Configurando canales de notificación...');
    
    // Sólo aplicable para Android
    if (Capacitor.getPlatform() !== 'android') {
      console.log('No es Android, no se configuran canales');
      return;
    }

    try {
      // Definir el canal como un objeto separado
      const channelConfig: Channel = {
        id: 'chat_messages',
        name: 'Mensajes de Chat',
        description: 'Notificaciones para nuevos mensajes de chat',
        importance: 5, // Equivalente a Importance.High
        visibility: 1, // Equivalente a Visibility.Public
        lights: true,
        lightColor: '#4CAF50',
        vibration: true
      };
      
      console.log('Configuración de canal:', JSON.stringify(channelConfig));
      await LocalNotifications.createChannel(channelConfig);

      console.log('Canales de notificación creados correctamente');
    } catch (error) {
      console.error('Error configurando canales de notificación:', error);
      console.error('Detalles del error:', JSON.stringify(error));
    }
  }

  /**
   * Suscribe al servicio para escuchar cambios en los chats del usuario
   */
  async subscribeToChats() {
    console.log('Iniciando suscripción a chats...');
    
    const user = this.auth.currentUser;
    if (!user) {
      console.log('No hay usuario autenticado, no se puede suscribir a chats');
      return;
    }

    console.log('Suscribiendo a chats para el usuario:', user.uid);

    // Obtener todos los chats del usuario y escuchar cambios
    const userChatsRef = ref(this.db, `userChats/${user.uid}`);
    onValue(userChatsRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.log('No se encontraron chats para el usuario');
        return;
      }
      
      const chats = snapshot.val();
      console.log(`Se encontraron ${Object.keys(chats).length} chats para monitorizar`);
      
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
    console.log(`Suscribiéndose a mensajes del chat ${chatId} para usuario ${userId}`);
    
    const messagesRef = ref(this.db, `messages/${chatId}`);
    
    // Utilizar onValue para escuchar cambios en tiempo real
    onValue(messagesRef, async (snapshot) => {
      console.log(`Cambios detectados en mensajes del chat ${chatId}`);
      
      if (!snapshot.exists()) {
        console.log('No hay mensajes en el chat');
        return;
      }
      
      // Obtener el chat para verificar participantes
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.log('El chat no existe');
        return;
      }
      
      const chat = chatSnapshot.val();
      console.log('Datos del chat:', JSON.stringify({
        chatId,
        unreadMessages: chat.unreadMessages ? Object.keys(chat.unreadMessages) : [],
        hasUnread: chat.unreadMessages && chat.unreadMessages[userId]
      }));
      
      // Verificar si hay mensajes no leídos para este usuario
      if (chat.unreadMessages && chat.unreadMessages[userId]) {
        console.log(`Usuario ${userId} tiene mensajes no leídos`);
        
        // Obtener el último mensaje del chat
        const messages = snapshot.val();
        const messageKeys = Object.keys(messages);
        const lastMessageKey = messageKeys[messageKeys.length - 1];
        const lastMessage = messages[lastMessageKey];
        
        console.log('Último mensaje:', {
          key: lastMessageKey,
          sender: lastMessage?.senderId,
          processed: this.lastProcessedMessages[chatId] === lastMessageKey
        });
        
        // Verificar si ya procesamos este mensaje
        if (this.lastProcessedMessages[chatId] === lastMessageKey) {
          console.log('Mensaje ya procesado, ignorando');
          return;
        }
        
        // Actualizar el último mensaje procesado
        this.lastProcessedMessages[chatId] = lastMessageKey;
        
        // Solo enviar notificación si el mensaje no fue enviado por el usuario actual
        if (lastMessage && lastMessage.senderId !== userId) {
          console.log('Mensaje enviado por otro usuario, procesando notificación');
          
          // Obtener datos del remitente
          const otherUserId = lastMessage.senderId;
          let senderName = lastMessage.senderName || 'Usuario';
          
          // Si la app está en segundo plano, enviar una notificación local
          await this.checkAppStateAndNotify(senderName, lastMessage.content, chatId);
        } else {
          console.log('Mensaje enviado por el usuario actual, no se notifica');
        }
      } else {
        console.log(`Usuario ${userId} no tiene mensajes no leídos`);
      }
    }, error => {
      console.error(`Error escuchando mensajes del chat ${chatId}:`, error);
    });
  }
  
  /**
   * Verifica el estado de la app y notifica si es necesario
   */
  private async checkAppStateAndNotify(sender: string, message: string, chatId: string) {
    try {
      console.log('Verificando estado de app para notificación:', {sender, chatId});
      
      // Verificar si la app está activa
      const appState = await App.getState();
      const isInForeground = appState.isActive;
      console.log('App en primer plano:', isInForeground);
      
      // Si la app está en segundo plano, enviar notificación
      if (!isInForeground) {
        console.log('App en segundo plano, enviando notificación local');
        await this.sendLocalNotification(sender, message, chatId);
        return;
      }
      
      // La app está en primer plano, verificar si estamos en el chat específico
      const currentUrl = this.router.url;
      console.log('URL actual:', currentUrl, 'Chat ID:', chatId);
      
      if (!currentUrl.includes(`/menu/mensajes/${chatId}`)) {
        console.log('No estamos en el chat específico, enviando notificación local');
        await this.sendLocalNotification(sender, message, chatId);
      } else {
        console.log('Estamos en el chat específico, no enviando notificación');
      }
    } catch (error) {
      console.error('Error verificando estado de la app:', error);
    }
  }
  
  /**
   * Envía una notificación local
   */
  private async sendLocalNotification(title: string, body: string, chatId: string) {
    console.log('Intentando enviar notificación local:', {title, body: body.substring(0, 20) + '...', chatId});
    
    if (!this.hasNotificationPermission.value) {
      console.error('No hay permiso para enviar notificaciones');
      return false;
    }
    
    try {
      const notificationId = new Date().getTime();
      
      console.log('Configurando notificación con ID:', notificationId);
      
      const notificationConfig = {
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
      };
      
      console.log('Configuración de notificación:', JSON.stringify(notificationConfig));
      await LocalNotifications.schedule(notificationConfig);
      
      console.log('Notificación local enviada correctamente');
      return true;
    } catch (error) {
      console.error('Error enviando notificación local:', error);
      console.error('Detalles del error:', JSON.stringify(error));
      return false;
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
      console.log('Configurando verificación periódica de mensajes en segundo plano');
      
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
      
      // También realizar una comprobación inmediata
      this.checkForNewMessages(userId);
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
      console.log(`Verificando mensajes no leídos para usuario ${userId}`);
      
      const userChatsRef = ref(this.db, `userChats/${userId}`);
      const snapshot = await get(userChatsRef);
      
      if (!snapshot.exists()) {
        console.log('No se encontraron chats para el usuario');
        return;
      }
      
      const chats = snapshot.val();
      console.log(`Verificando ${Object.keys(chats).length} chats`);
      
      for (const chatId in chats) {
        const chatRef = ref(this.db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        
        if (!chatSnapshot.exists()) continue;
        
        const chat = chatSnapshot.val();
        
        // Verificar si hay mensajes no leídos
        if (chat.unreadMessages && chat.unreadMessages[userId]) {
          console.log(`Chat ${chatId}: tiene mensajes no leídos`);
          
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
            console.log(`Mensaje ya procesado para chat ${chatId}, ignorando`);
            continue;
          }
          
          // Actualizar el último mensaje procesado
          this.lastProcessedMessages[chatId] = lastMessageKey;
          
          // Solo notificar si el mensaje no fue enviado por el usuario actual
          if (lastMessage && lastMessage.senderId !== userId) {
            // Obtener datos del remitente
            const otherUserId = lastMessage.senderId;
            let senderName = lastMessage.senderName || 'Usuario';
            
            console.log(`Enviando notificación para mensaje de ${senderName} en chat ${chatId}`);
            
            // Enviar notificación
            await this.sendLocalNotification(senderName, lastMessage.content, chatId);
          }
        }
      }
    } catch (error) {
      console.error('Error verificando nuevos mensajes:', error);
    }
  }

  /**
   * Método para probar las notificaciones locales
   */
  public async testLocalNotification(): Promise<boolean> {
    console.log('Ejecutando prueba de notificación local');
    
    // Verificar permisos primero
    const permResult = await LocalNotifications.requestPermissions();
    console.log('Estado de permisos:', permResult);
    
    if (permResult.display !== 'granted') {
      console.error('No hay permiso para enviar notificaciones');
      return false;
    }
    
    try {
      const testId = Date.now();
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Prueba de Notificación',
            body: 'Esta es una notificación de prueba para verificar si el sistema funciona.',
            id: testId,
            sound: 'default',
            extra: {
              test: true
            },
            channelId: 'chat_messages'
          }
        ]
      });
      
      console.log('Notificación de prueba enviada correctamente');
      return true;
    } catch (error) {
      console.error('Error enviando notificación de prueba:', error);
      return false;
    }
  }
}
import { Injectable } from '@angular/core';
import { Database, ref, push, set, onValue, get, update, query, orderByChild, remove } from '@angular/fire/database';
import { Observable, from, of, combineLatest, BehaviorSubject } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { ChatStorageService } from './chat-storage.service';
import { NetworkService } from './network.service';

interface Message {
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  readBy: { [key: string]: boolean };
  id?: string;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: number;
  createdAt: number;
  unreadMessages?: { [key: string]: boolean };
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private forceRefresh$ = new BehaviorSubject<boolean>(false);

  constructor(
    private db: Database,
    private storageService: ChatStorageService,
    private networkService: NetworkService
  ) { }

  private async sendNotificationForNewMessage(chatId: string, senderId: string, message: string): Promise<void> {
    try {
      // Obtener información del chat
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) return;
      
      const chat = chatSnapshot.val();
      
      // Obtener los IDs de los otros participantes (que no son el remitente)
      const recipients = chat.participants.filter((participantId: string) => participantId !== senderId);
      
      // Para cada destinatario, enviar una notificación
      for (const recipientId of recipients) {
        // Verificar si el usuario está en línea y en este chat
        const userStatusRef = ref(this.db, `userStatus/${recipientId}`);
        const userStatusSnapshot = await get(userStatusRef);
        const userIsOnline = userStatusSnapshot.exists() && 
                             userStatusSnapshot.val().status === 'online' && 
                             userStatusSnapshot.val().currentChatId === chatId;
        
        // Si el usuario está activo en este chat, no enviamos notificación push
        if (userIsOnline) {
          console.log(`Usuario ${recipientId} está activo en este chat, omitiendo notificación push`);
          continue;
        }
  
        // Obtener el token del dispositivo del destinatario
        const tokenRef = ref(this.db, `deviceTokens/${recipientId}`);
        const tokenSnapshot = await get(tokenRef);
        
        if (!tokenSnapshot.exists()) {
          console.log(`No se encontró token para el usuario ${recipientId}`);
          continue;
        }
        
        const tokenData = tokenSnapshot.val();
        const token = typeof tokenData === 'string' ? tokenData : tokenData.token;
        
        if (!token) {
          console.log(`Token inválido para el usuario ${recipientId}`);
          continue;
        }
        
        // Obtener el nombre del remitente
        const senderDataRef = ref(this.db, `usuarios/${senderId}`);
        const senderSnapshot = await get(senderDataRef);
        let senderName = "Usuario";
        let senderPhotoURL = null;
        
        if (senderSnapshot.exists()) {
          const userData = senderSnapshot.val();
          senderName = `${userData.nombre} ${userData.apellido}`;
          senderPhotoURL = userData.photoURL || null;
        }
        
        // Crear datos de la notificación más completos
        const notificationData = {
          recipientToken: token,
          title: senderName,
          body: message.length > 100 ? message.substring(0, 97) + '...' : message,
          chatId: chatId,
          senderId: senderId,
          recipientId: recipientId,
          type: 'newMessage',
          timestamp: Date.now(),
          imageUrl: senderPhotoURL,
          platform: tokenData.platform || 'unknown'
        };
        
        // Guardar en Firebase para que Cloud Functions lo procese
        const notificationsRef = ref(this.db, 'notifications');
        const newNotificationRef = push(notificationsRef);
        await set(newNotificationRef, notificationData);
        
        console.log(`Notification queued for user ${recipientId}`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  async startChat(user1Id: string, user2Id: string): Promise<string> {
    try {
      // Verificar si ya existe un chat
      const existingChat = await this.findExistingChat(user1Id, user2Id);
      if (existingChat) {
        return existingChat;
      }

      const timestamp = Date.now();

      // Crear nuevo chat
      const chatsRef = ref(this.db, 'chats');
      const newChatRef = push(chatsRef);

      if (!newChatRef.key) {
        throw new Error('Failed to create chat reference');
      }

      const chatId = newChatRef.key;

      // Datos del nuevo chat
      const chatData: Chat = {
        id: chatId,
        participants: [user1Id, user2Id],
        createdAt: timestamp,
        lastMessageTimestamp: timestamp
      };

      // Datos para userChats
      const userChatData = {
        timestamp: timestamp,
        lastRead: timestamp
      };

      // Crear el chat primero
      const chatRef = ref(this.db, `chats/${chatId}`);
      await set(chatRef, chatData);

      // Luego crear las referencias de usuarios
      const user1ChatRef = ref(this.db, `userChats/${user1Id}/${chatId}`);
      const user2ChatRef = ref(this.db, `userChats/${user2Id}/${chatId}`);

      await Promise.all([
        set(user1ChatRef, userChatData),
        set(user2ChatRef, userChatData)
      ]);

      return chatId;

    } catch (error: unknown) {
      console.error('Error creating chat:', error);
      console.log('Attempted by user1Id:', user1Id);
      console.log('Attempted with user2Id:', user2Id);

      const errorMessage = error instanceof Error
        ? error.message
        : 'An unknown error occurred';

      throw new Error(`Failed to create chat: ${errorMessage}`);
    }
  }

  async getChat(chatId: string): Promise<Chat | null> {
    try {
      const chatRef = ref(this.db, `chats/${chatId}`);
      const snapshot = await get(chatRef);
      if (snapshot.exists()) {
        const chatData = snapshot.val();
        return {
          ...chatData,
          id: chatId
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  }

  private async findExistingChat(user1Id: string, user2Id: string): Promise<string | null> {
    try {
      const userChatsRef = ref(this.db, `userChats/${user1Id}`);
      const snapshot = await get(userChatsRef);

      if (!snapshot.exists()) return null;

      const chats = snapshot.val();

      for (const chatId in chats) {
        const chatRef = ref(this.db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);

        if (!chatSnapshot.exists()) continue;

        const chat = chatSnapshot.val();
        if (chat.participants.includes(user1Id) && chat.participants.includes(user2Id)) {
          return chatId;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding existing chat:', error);
      return null;
    }
  }

  async sendMessage(chatId: string, senderId: string, senderName: string, content: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const message = {
        content,
        senderId,
        senderName,
        timestamp,
        readBy: {
          [senderId]: true
        }
      };
      
      // Obtener referencia del chat
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      const chatData = chatSnapshot.val();
      
      // Preparar el estado de lectura para otros participantes
      const unreadMessages: Record<string, boolean> = {};
      chatData.participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          unreadMessages[participantId] = true;
        }
      });
      
      // Crear el nuevo mensaje
      const newMessageRef = push(ref(this.db, `messages/${chatId}`));
      
      // Actualizaciones atómicas
      const updates: any = {};
      updates[`messages/${chatId}/${newMessageRef.key}`] = message;
      updates[`chats/${chatId}/lastMessage`] = content;
      updates[`chats/${chatId}/lastMessageTimestamp`] = timestamp;
      updates[`chats/${chatId}/unreadMessages`] = unreadMessages;
      
      // Realizar todas las actualizaciones en una sola operación
      await update(ref(this.db), updates);
      
      // Enviar notificación por el nuevo mensaje
      await this.sendNotificationForNewMessage(chatId, senderId, content);
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Add new method to mark messages as read
  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const updates: any = {};
      updates[`chats/${chatId}/unreadMessages/${userId}`] = false;

      const messagesRef = ref(this.db, `messages/${chatId}`);
      const snapshot = await get(messagesRef);
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          updates[`messages/${chatId}/${childSnapshot.key}/readBy/${userId}`] = true;
        });
      }

      await update(ref(this.db), updates);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }

  getMessages(chatId: string): Observable<Message[]> {
    return new Observable(subscriber => {
      const messagesRef = ref(this.db, `messages/${chatId}`);

      const unsubscribe = onValue(messagesRef, snapshot => {
        if (!snapshot.exists()) {
          subscriber.next([]);
          return;
        }

        const messages: Message[] = [];
        snapshot.forEach((childSnapshot) => {
          const message = childSnapshot.val();
          messages.push(message);
        });

        messages.sort((a, b) => a.timestamp - b.timestamp);
        subscriber.next(messages);
      }, error => {
        console.error('Error fetching messages:', error);
        subscriber.error(error);
      });

      return () => unsubscribe();
    });
  }

  getUserChats(userId: string): Observable<Chat[]> {
    return new Observable(subscriber => {
      const userChatsRef = ref(this.db, `userChats/${userId}`);
      const unsubscribe = onValue(userChatsRef, async snapshot => {
        try {
          if (!snapshot.exists()) {
            subscriber.next([]);
            return;
          }
          const chatIds = Object.keys(snapshot.val());
          const chats: Chat[] = [];
          
          for (const chatId of chatIds) {
            const chatRef = ref(this.db, `chats/${chatId}`);
            const chatSnapshot = await get(chatRef);
            if (chatSnapshot.exists()) {
              const chatData = chatSnapshot.val();
              chats.push({
                ...chatData,
                id: chatId
              });
            }
          }
          
          // Ordenar chats por timestamp del último mensaje, más reciente primero
          chats.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
          
          subscriber.next(chats);
        } catch (error) {
          console.error('Error getting user chats:', error);
          subscriber.error(error);
        }
      });
      
      return () => unsubscribe();
    });
  }

  getUserChatsRealtime(userId: string): Observable<Chat[]> {
    if (!userId) {
      console.log('No userId provided to getUserChatsRealtime');
      return of([]);
    }
    
    // Combinamos la fuente local y la remota
    return combineLatest([
      // Datos locales (cargados inmediatamente)
      this.storageService.getUserChats(userId),
      
      // Indicador de refresco forzado
      this.forceRefresh$,
      
      // Estado de la red
      this.networkService.isOnline$
    ]).pipe(
      switchMap(([localChats, forceRefresh, isOnline]) => {
        console.log('Chats locales cargados:', localChats.length);
        
        // Si no hay conexión, devolvemos solo los datos locales
        if (!isOnline) {
          console.log('Sin conexión: usando solo datos locales');
          return of(localChats);
        }
        
        // Si hay datos locales y no se fuerza actualización, los devolvemos primero
        if (localChats.length > 0 && !forceRefresh) {
          // Emitimos los datos locales primero mientras cargamos los remotos
          setTimeout(() => this.loadRemoteChats(userId), 0);
          return of(localChats);
        }
        
        // Si no hay datos locales o se fuerza actualización, cargamos datos remotos
        return this.loadRemoteChats(userId);
      })
    );
  }
  
  getMessagesRealtime(chatId: string): Observable<Message[]> {
    if (!chatId) return of([]);
    
    return combineLatest([
      // Datos locales (cargados inmediatamente)
      this.storageService.getChatMessages(chatId),
      
      // Indicador de refresco forzado
      this.forceRefresh$,
      
      // Estado de la red
      this.networkService.isOnline$
    ]).pipe(
      switchMap(([localMessages, forceRefresh, isOnline]) => {
        console.log('Mensajes locales cargados:', localMessages.length);
        
        // Si no hay conexión, devolvemos solo los datos locales
        if (!isOnline) {
          console.log('Sin conexión: usando solo mensajes locales');
          return of(localMessages);
        }
        
        // Si hay datos locales y no se fuerza actualización, los devolvemos primero
        if (localMessages.length > 0 && !forceRefresh) {
          // Emitimos los datos locales primero mientras cargamos los remotos
          setTimeout(() => this.loadRemoteMessages(chatId), 0);
          return of(localMessages);
        }
        
        // Si no hay datos locales o se fuerza actualización, cargamos datos remotos
        return this.loadRemoteMessages(chatId);
      })
    );
  }

  private loadRemoteChats(userId: string): Observable<Chat[]> {
    console.log('Cargando chats desde Firebase para:', userId);
    
    return new Observable<Chat[]>(subscriber => {
      const userChatsRef = ref(this.db, `userChats/${userId}`);
      
      const unsubscribe = onValue(userChatsRef, async (snapshot) => {
        try {
          console.log('UserChats snapshot recibido desde Firebase');
          
          if (!snapshot.exists()) {
            console.log('No se encontraron chats para el usuario');
            subscriber.next([]);
            
            // Guardar el array vacío en almacenamiento local
            await this.storageService.saveUserChats(userId, []);
            return;
          }
  
          // Obtener todos los chats del usuario
          const userChatsData = snapshot.val();
          const chatsPromises = Object.keys(userChatsData).map(async (chatId) => {
            const chatRef = ref(this.db, `chats/${chatId}`);
            const chatSnapshot = await get(chatRef);
            
            if (chatSnapshot.exists()) {
              const chatData = chatSnapshot.val();
              return {
                ...chatData,
                id: chatId,
                unreadMessages: chatData.unreadMessages || {}
              };
            }
            return null;
          });
  
          // Esperar a que se resuelvan todas las promesas
          const chats = (await Promise.all(chatsPromises))
            .filter(chat => chat !== null)
            .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
  
          console.log('Emitiendo chats actualizados desde Firebase:', chats.length);
          
          // Guardar en almacenamiento local
          await this.storageService.saveUserChats(userId, chats);
          
          subscriber.next(chats);
        } catch (error) {
          console.error('Error obteniendo chats del usuario:', error);
          subscriber.error(error);
        }
      }, error => {
        console.error('Error en suscripción de chats:', error);
        subscriber.error(error);
      });
  
      // Función de limpieza
      return () => {
        console.log('Limpiando suscripción de chats');
        unsubscribe();
      };
    });
  }
  
  forceRefreshChats(): void {
    this.forceRefresh$.next(true);
    // Reiniciamos después de un tiempo para futuras solicitudes
    setTimeout(() => this.forceRefresh$.next(false), 100);
  }

  private loadRemoteMessages(chatId: string): Observable<Message[]> {
    console.log('Cargando mensajes desde Firebase para chat:', chatId);
    
    return new Observable<Message[]>(subscriber => {
      const messagesRef = ref(this.db, `messages/${chatId}`);
      const orderedRef = query(messagesRef, orderByChild('timestamp'));

      const unsubscribe = onValue(orderedRef, async (snapshot) => {
        try {
          if (!snapshot.exists()) {
            subscriber.next([]);
            
            // Guardar el array vacío en almacenamiento local
            await this.storageService.saveChatMessages(chatId, []);
            return;
          }

          const messages: Message[] = [];
          snapshot.forEach((childSnapshot) => {
            messages.push({
              id: childSnapshot.key || undefined,
              ...childSnapshot.val()
            });
          });
          
          // Guardar en almacenamiento local
          await this.storageService.saveChatMessages(chatId, messages);

          subscriber.next(messages);
        } catch (error) {
          console.error('Error obteniendo mensajes:', error);
          subscriber.error(error);
        }
      }, error => {
        console.error('Error en suscripción de mensajes:', error);
        subscriber.error(error);
      });

      return () => unsubscribe();
    });
  }

  forceRefreshMessages(): void {
    this.forceRefresh$.next(true);
    // Reiniciamos después de un tiempo para futuras solicitudes
    setTimeout(() => this.forceRefresh$.next(false), 100);
  }
  
  // Método para limpiar datos de usuario al cerrar sesión
  async clearUserData(userId: string): Promise<void> {
    if (!userId) return;
    await this.storageService.clearUserData(userId);
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    if (!chatId || !userId) {
      throw new Error('Se requieren chatId y userId para eliminar un chat');
    }

    try {
      // Verificar que el chat exista y que el usuario sea participante
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('El chat no existe');
      }
      
      const chatData = chatSnapshot.val();
      
      // Verificar que el usuario sea participante del chat
      if (!chatData.participants.includes(userId)) {
        throw new Error('El usuario no es participante de este chat');
      }
      
      // 1. Eliminar la referencia del chat para este usuario
      const userChatRef = ref(this.db, `userChats/${userId}/${chatId}`);
      await remove(userChatRef);
      
      // 2. Actualizar el estado del chat (opcional: marcar como eliminado para este usuario)
      // Podríamos mantener un registro de quién ha eliminado el chat sin eliminarlo completamente
      const updates: any = {};
      updates[`chats/${chatId}/deletedBy/${userId}`] = true;
      await update(ref(this.db), updates);
      
      // 3. Si ambos usuarios han eliminado el chat, eliminar completamente el chat y sus mensajes
      const otherUserId = chatData.participants.find((id: string) => id !== userId);
      if (otherUserId && chatData.deletedBy && chatData.deletedBy[otherUserId]) {
        // Ambos usuarios han eliminado el chat, eliminarlo completamente
        await remove(ref(this.db, `chats/${chatId}`));
        await remove(ref(this.db, `messages/${chatId}`));
      }
      
      // 4. Eliminar también de la caché local
      await this.storageService.deleteChatData(chatId, userId);
      
      // 5. Forzar actualización de la lista de chats
      this.forceRefreshChats();
      
      console.log(`Chat ${chatId} eliminado exitosamente para el usuario ${userId}`);
      
    } catch (error) {
      console.error('Error al eliminar chat:', error);
      throw new Error('No se pudo eliminar el chat');
    }
  }
}
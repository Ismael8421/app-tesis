import { Injectable } from '@angular/core';
import { Database, ref, push, set, onValue, get, update, query, orderByChild, remove } from '@angular/fire/database';
import { Observable, from, of, combineLatest, BehaviorSubject, Subject } from 'rxjs';
import { map, switchMap, tap, catchError, shareReplay, share } from 'rxjs/operators';
import { ChatStorageService } from './chat-storage.service';
import { NetworkService } from './network.service';

interface Message {
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  readBy: { [key: string]: boolean };
  id?: string;
  isTemp?: boolean;
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

  // Nuevo: Subjects para notificar eventos específicos a los componentes
  private chatDeleted$ = new Subject<{ chatId: string, userId: string }>();
  private messageAdded$ = new Subject<{ chatId: string, message: any }>();

  // Exponer los subjects como observables
  public chatDeletedEvent$ = this.chatDeleted$.asObservable();
  public messageAddedEvent$ = this.messageAdded$.asObservable();

  constructor(
    private db: Database,
    private storageService: ChatStorageService,
    private networkService: NetworkService,
  ) { }

  async startChat(user1Id: string, user2Id: string): Promise<string> {
    try {
      // Verificar si ya existe un chat activo para user1
      const existingChat = await this.findExistingChat(user1Id, user2Id);
      if (existingChat) {
        return existingChat;
      }

      // Verificar si hay un chat que user1 eliminó pero user2 aún tiene
      const deletedChat = await this.findDeletedChatByUser(user1Id, user2Id);

      if (deletedChat) {
        // Restaurar el chat para user1 en lugar de eliminarlo completamente
        await this.restoreChatForUser(deletedChat, user1Id);
        console.log(`Chat existente ${deletedChat} restaurado para usuario ${user1Id}`);
        return deletedChat;
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

  private async restoreChatForUser(chatId: string, userId: string): Promise<void> {
    try {
      // Obtener información del chat
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.log(`El chat ${chatId} no existe`);
        return;
      }
      
      // Marcar el chat como no eliminado para este usuario
      const updates: any = {};
      updates[`chats/${chatId}/deletedBy/${userId}`] = null;
      
      // Restaurar la entrada en userChats para este usuario
      const timestamp = Date.now();
      updates[`userChats/${userId}/${chatId}`] = {
        timestamp: timestamp,
        lastRead: timestamp
      };
      
      // Aplicar las actualizaciones
      await update(ref(this.db), updates);
      
      console.log(`Chat ${chatId} restaurado para usuario ${userId}`);
    } catch (error) {
      console.error('Error restaurando chat para usuario:', error);
    }
  }

  private async findActiveChatForUser(userId: string, otherUserId: string): Promise<string | null> {
    try {
      const userChatsRef = ref(this.db, `userChats/${userId}`);
      const snapshot = await get(userChatsRef);

      if (!snapshot.exists()) return null;

      const chats = snapshot.val();

      for (const chatId in chats) {
        const chatRef = ref(this.db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);

        if (!chatSnapshot.exists()) continue;

        const chat = chatSnapshot.val();
        if (chat.participants.includes(userId) && chat.participants.includes(otherUserId)) {
          return chatId;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding active chat:', error);
      return null;
    }
  }

  // Busca un chat que fue eliminado por un usuario pero aún existe para el otro
  private async findDeletedChatByUser(userId: string, otherUserId: string): Promise<string | null> {
    try {
      // Buscar en los chats globales (no en userChats, ya que el usuario lo eliminó)
      const chatsRef = ref(this.db, 'chats');
      const chatsSnapshot = await get(chatsRef);

      if (!chatsSnapshot.exists()) {
        return null;
      }

      let deletedChatId: string | null = null;

      chatsSnapshot.forEach((childSnapshot) => {
        const chat = childSnapshot.val();
        const chatId = childSnapshot.key;

        // Verificar si este chat incluye a ambos usuarios y fue eliminado por userId
        if (chat.participants &&
          chat.participants.includes(userId) &&
          chat.participants.includes(otherUserId) &&
          chat.deletedBy &&
          chat.deletedBy[userId]) {
          deletedChatId = chatId;
          // No hacemos return false aquí para continuar el bucle y encontrar el chat más reciente
        }
      });

      return deletedChatId;
    } catch (error) {
      console.error('Error buscando chat eliminado:', error);
      return null;
    }
  }

  // Elimina completamente un chat para todos los participantes
  private async completelyRemoveChat(chatId: string): Promise<void> {
    try {
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);

      if (!chatSnapshot.exists()) return;

      const chat = chatSnapshot.val();

      // Eliminar referencias para todos los participantes
      for (const participantId of chat.participants) {
        const userChatRef = ref(this.db, `userChats/${participantId}/${chatId}`);
        await remove(userChatRef);
      }

      // Eliminar el chat y sus mensajes
      await remove(chatRef);
      await remove(ref(this.db, `messages/${chatId}`));

      console.log(`Chat ${chatId} eliminado completamente`);
    } catch (error) {
      console.error('Error eliminando chat completamente:', error);
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

  async sendMessage(chatId: string, senderId: string, senderName: string, content: string): Promise<string> {
    try {
      const timestamp = Date.now();
      
      // Obtener referencia del chat
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('El chat no existe');
      }
      
      const chatData = chatSnapshot.val();
      
      // Verificar si algún participante ha eliminado el chat
      if (chatData.deletedBy) {
        for (const participantId of chatData.participants) {
          if (participantId !== senderId && chatData.deletedBy[participantId]) {
            // Restaurar el chat para el usuario que lo había eliminado
            await this.restoreChatForUser(chatId, participantId);
          }
        }
      }
      
      // Preparar el estado de lectura para otros participantes
      const unreadMessages: Record<string, boolean> = {};
      chatData.participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          unreadMessages[participantId] = true;
        }
      });
      
      // Crear el nuevo mensaje
      const newMessageRef = push(ref(this.db, `messages/${chatId}`));
      
      const message = {
        content,
        senderId,
        senderName,
        timestamp,
        readBy: {
          [senderId]: true
        }
      };
      
      // Actualizaciones atómicas
      const updates: any = {};
      updates[`messages/${chatId}/${newMessageRef.key}`] = message;
      updates[`chats/${chatId}/lastMessage`] = content;
      updates[`chats/${chatId}/lastMessageTimestamp`] = timestamp;
      
      // Importante: Actualizar unreadMessages para cada participante
      for (const participantId of chatData.participants) {
        if (participantId !== senderId) {
          updates[`chats/${chatId}/unreadMessages/${participantId}`] = true;
        } else {
          // El remitente ya ha leído el mensaje
          updates[`chats/${chatId}/unreadMessages/${participantId}`] = false;
        }
      }
      
      // Realizar todas las actualizaciones en una sola operación
      await update(ref(this.db), updates);
      
      // Notificar sobre el nuevo mensaje
      this.messageAdded$.next({
        chatId, 
        message: {...message, id: newMessageRef.key}
      });
      
      // Forzar actualizaciones de UI
      this.forceRefreshChats();
      
      return newMessageRef.key || '';
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Add new method to mark messages as read
  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      // Comprobación de conectividad
      if (!navigator.onLine) {
        console.log('Sin conexión, no se pueden marcar mensajes como leídos');
        return;
      }
  
      console.log(`Marcando mensajes como leídos para usuario ${userId} en chat ${chatId}`);
      
      // 1. Obtener el chat actual para verificar que existe
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.log('El chat no existe, no se pueden marcar mensajes');
        return;
      }
      
      // Obtener los datos del chat
      const chatData = chatSnapshot.val();
      
      // Solo procesar si el indicador de no leído está activo
      if (chatData.unreadMessages && chatData.unreadMessages[userId] === true) {
        // Preparamos las actualizaciones como un objeto
        const updates: any = {};
        
        // 2. Actualizar el estado de lectura en el chat (muy importante)
        updates[`chats/${chatId}/unreadMessages/${userId}`] = false;
    
        // 3. Obtener mensajes y marcarlos como leídos también
        const messagesRef = ref(this.db, `messages/${chatId}`);
        const snapshot = await get(messagesRef);
    
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const messageData = childSnapshot.val();
            // Solo actualizar si el mensaje no ha sido leído
            if (!messageData.readBy || !messageData.readBy[userId]) {
              updates[`messages/${chatId}/${childSnapshot.key}/readBy/${userId}`] = true;
            }
          });
        }
    
        // 4. Realizar todas las actualizaciones en una sola operación atómica
        await update(ref(this.db), updates);
        
        // 5. Actualizar también localmente para reflejar cambios inmediatamente
        this.forceRefreshChats();
        this.forceRefreshMessages();
        
        console.log(`Mensajes marcados como leídos exitosamente para ${userId}`);
      } else {
        console.log(`Los mensajes ya estaban marcados como leídos para ${userId}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw new Error('Failed to mark messages as read');
    }
  }

  getMessages(chatId: string): Observable<Message[]> {
    return new Observable<Message[]>(subscriber => {
      const messagesRef = ref(this.db, `messages/${chatId}`);
  
      const unsubscribe = onValue(messagesRef, snapshot => {
        if (!snapshot.exists()) {
          subscriber.next([]);
          return;
        }
  
        const messages: Message[] = [];
        snapshot.forEach((childSnapshot) => {
          const message = childSnapshot.val();
          messages.push({
            ...message,
            id: childSnapshot.key
          });
        });
  
        messages.sort((a, b) => a.timestamp - b.timestamp);
        subscriber.next(messages);
      }, error => {
        console.error('Error fetching messages:', error);
        subscriber.error(error);
      });
  
      return () => unsubscribe();
    }).pipe(share());
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

    // Usar shareReplay para compartir la suscripción entre múltiples observadores
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
      }),
      // Compartir la suscripción entre múltiples observadores
      shareReplay(1)
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
    console.log('Forzando actualización de UI para chats');
    // Emitir múltiples veces para asegurar que se procesa
    this.forceRefresh$.next(true);
    
    // Emitir de nuevo después de un breve retraso
    setTimeout(() => {
      this.forceRefresh$.next(true);
      // Reiniciar después
      setTimeout(() => this.forceRefresh$.next(false), 50);
    }, 50);
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
    console.log('Forzando actualización de UI para mensajes');
    // Emitir múltiples veces para asegurar que se procesa
    this.forceRefresh$.next(true);
    
    // Emitir de nuevo después de un breve retraso
    setTimeout(() => {
      this.forceRefresh$.next(true);
      // Reiniciar después
      setTimeout(() => this.forceRefresh$.next(false), 50);
    }, 50);
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
      
      // 2. Marcar como eliminado para este usuario en el chat
      const updates: any = {};
      updates[`chats/${chatId}/deletedBy/${userId}`] = true;
      await update(ref(this.db), updates);
      
      // 3. Solo si ambos usuarios han eliminado el chat, eliminar los mensajes
      const otherUserId = chatData.participants.find((id: string) => id !== userId);
      if (otherUserId && chatData.deletedBy && chatData.deletedBy[otherUserId]) {
        // Ambos usuarios han eliminado el chat, eliminar mensajes
        await remove(ref(this.db, `messages/${chatId}`));
      }
      
      // 4. Eliminar también de la caché local
      await this.storageService.deleteChatData(chatId, userId);
      
      // 5. Emitir evento de chat eliminado
      this.chatDeleted$.next({chatId, userId});
      
      // 6. Forzar actualización de la lista de chats
      this.forceRefreshChats();
      
      console.log(`Chat ${chatId} eliminado para el usuario ${userId}`);
      
    } catch (error) {
      console.error('Error al eliminar chat:', error);
      throw new Error('No se pudo eliminar el chat');
    }
  }
}
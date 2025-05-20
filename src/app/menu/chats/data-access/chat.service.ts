import { Injectable, inject } from '@angular/core';
import { Database, ref, push, set, onValue, get, update, query, orderByChild, remove } from '@angular/fire/database';
import { Observable, from, of, combineLatest, BehaviorSubject, Subject } from 'rxjs';
import { map, switchMap, tap, catchError, shareReplay, share } from 'rxjs/operators';
import { ChatStorageService } from './chat-storage.service';
import { NetworkService } from './network.service';
import { NotificationSenderService } from '../data-access/notification-sender.service';

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
  private chatDeleted$ = new Subject<{ chatId: string, userId: string }>();
  private messageAdded$ = new Subject<{ chatId: string, message: any }>();
  public chatDeletedEvent$ = this.chatDeleted$.asObservable();
  public messageAddedEvent$ = this.messageAdded$.asObservable();

  private db = inject(Database);
  private storageService = inject(ChatStorageService);
  private networkService = inject(NetworkService);
  private notificationSender = inject(NotificationSenderService);

  constructor() { }

  async startChat(user1Id: string, user2Id: string): Promise<string> {
    try {
      const existingChat = await this.findExistingChat(user1Id, user2Id);
      if (existingChat) {
        return existingChat;
      }

      const deletedChat = await this.findDeletedChatByUser(user1Id, user2Id);
      if (deletedChat) {
        await this.restoreChatForUser(deletedChat, user1Id);
        console.log(`Chat existente ${deletedChat} restaurado para usuario ${user1Id}`);
        return deletedChat;
      }

      const timestamp = Date.now();
      const chatsRef = ref(this.db, 'chats');
      const newChatRef = push(chatsRef);

      if (!newChatRef.key) {
        throw new Error('Failed to create chat reference');
      }

      const chatId = newChatRef.key;
      const chatData: Chat = {
        id: chatId,
        participants: [user1Id, user2Id],
        createdAt: timestamp,
        lastMessageTimestamp: timestamp
      };

      const userChatData = {
        timestamp: timestamp,
        lastRead: timestamp
      };

      const chatRef = ref(this.db, `chats/${chatId}`);
      await set(chatRef, chatData);

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
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.log(`El chat ${chatId} no existe`);
        return;
      }
      
      const updates: any = {};
      updates[`chats/${chatId}/deletedBy/${userId}`] = null;
      
      const timestamp = Date.now();
      updates[`userChats/${userId}/${chatId}`] = {
        timestamp: timestamp,
        lastRead: timestamp
      };
      
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

  private async findDeletedChatByUser(userId: string, otherUserId: string): Promise<string | null> {
    try {
      const chatsRef = ref(this.db, 'chats');
      const chatsSnapshot = await get(chatsRef);

      if (!chatsSnapshot.exists()) {
        return null;
      }

      let deletedChatId: string | null = null;

      chatsSnapshot.forEach((childSnapshot) => {
        const chat = childSnapshot.val();
        const chatId = childSnapshot.key;

        if (chat.participants &&
          chat.participants.includes(userId) &&
          chat.participants.includes(otherUserId) &&
          chat.deletedBy &&
          chat.deletedBy[userId]) {
          deletedChatId = chatId;
        }
      });

      return deletedChatId;
    } catch (error) {
      console.error('Error buscando chat eliminado:', error);
      return null;
    }
  }

  private async completelyRemoveChat(chatId: string): Promise<void> {
    try {
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);

      if (!chatSnapshot.exists()) return;

      const chat = chatSnapshot.val();

      for (const participantId of chat.participants) {
        const userChatRef = ref(this.db, `userChats/${participantId}/${chatId}`);
        await remove(userChatRef);
      }

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
      
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('El chat no existe');
      }
      
      const chatData = chatSnapshot.val();
      
      if (chatData.deletedBy) {
        for (const participantId of chatData.participants) {
          if (participantId !== senderId && chatData.deletedBy[participantId]) {
            await this.restoreChatForUser(chatId, participantId);
          }
        }
      }
      
      const unreadMessages: Record<string, boolean> = {};
      chatData.participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          unreadMessages[participantId] = true;
        }
      });
      
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
      
      const updates: any = {};
      updates[`messages/${chatId}/${newMessageRef.key}`] = message;
      updates[`chats/${chatId}/lastMessage`] = content;
      updates[`chats/${chatId}/lastMessageTimestamp`] = timestamp;
      
      for (const participantId of chatData.participants) {
        if (participantId !== senderId) {
          updates[`chats/${chatId}/unreadMessages/${participantId}`] = true;
        } else {
          updates[`chats/${chatId}/unreadMessages/${participantId}`] = false;
        }
      }
      
      await update(ref(this.db), updates);
      
      this.messageAdded$.next({
        chatId, 
        message: {...message, id: newMessageRef.key}
      });
      
      this.forceRefreshChats();
      
      return newMessageRef.key || '';
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      if (!navigator.onLine) {
        console.log('Sin conexión, no se pueden marcar mensajes como leídos');
        return;
      }
  
      console.log(`Marcando mensajes como leídos para usuario ${userId} en chat ${chatId}`);
      
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.log('El chat no existe, no se pueden marcar mensajes');
        return;
      }
      
      const chatData = chatSnapshot.val();
      
      if (chatData.unreadMessages && chatData.unreadMessages[userId] === true) {
        const updates: any = {};
        
        updates[`chats/${chatId}/unreadMessages/${userId}`] = false;
    
        const messagesRef = ref(this.db, `messages/${chatId}`);
        const snapshot = await get(messagesRef);
    
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const messageData = childSnapshot.val();
            if (!messageData.readBy || !messageData.readBy[userId]) {
              updates[`messages/${chatId}/${childSnapshot.key}/readBy/${userId}`] = true;
            }
          });
        }
    
        await update(ref(this.db), updates);
        
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

    return combineLatest([
      this.storageService.getUserChats(userId),
      this.forceRefresh$,
      this.networkService.isOnline$
    ]).pipe(
      switchMap(([localChats, forceRefresh, isOnline]) => {
        console.log('Chats locales cargados:', localChats.length);

        if (!isOnline) {
          console.log('Sin conexión: usando solo datos locales');
          return of(localChats);
        }

        if (localChats.length > 0 && !forceRefresh) {
          setTimeout(() => this.loadRemoteChats(userId), 0);
          return of(localChats);
        }

        return this.loadRemoteChats(userId);
      })
    );
  }

  getMessagesRealtime(chatId: string): Observable<Message[]> {
    if (!chatId) return of([]);

    return combineLatest([
      this.storageService.getChatMessages(chatId),
      this.forceRefresh$,
      this.networkService.isOnline$
    ]).pipe(
      switchMap(([localMessages, forceRefresh, isOnline]) => {
        console.log('Mensajes locales cargados:', localMessages.length);

        if (!isOnline) {
          console.log('Sin conexión: usando solo mensajes locales');
          return of(localMessages);
        }

        if (localMessages.length > 0 && !forceRefresh) {
          setTimeout(() => this.loadRemoteMessages(chatId), 0);
          return of(localMessages);
        }

        return this.loadRemoteMessages(chatId);
      }),
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
            await this.storageService.saveUserChats(userId, []);
            return;
          }

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

          const chats = (await Promise.all(chatsPromises))
            .filter(chat => chat !== null)
            .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));

          console.log('Emitiendo chats actualizados desde Firebase:', chats.length);
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

      return () => {
        console.log('Limpiando suscripción de chats');
        unsubscribe();
      };
    });
  }

  forceRefreshChats(): void {
    console.log('Forzando actualización de UI para chats');
    this.forceRefresh$.next(true);
    setTimeout(() => {
      this.forceRefresh$.next(true);
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
    this.forceRefresh$.next(true);
    setTimeout(() => {
      this.forceRefresh$.next(true);
      setTimeout(() => this.forceRefresh$.next(false), 50);
    }, 50);
  }

  async clearUserData(userId: string): Promise<void> {
    if (!userId) return;
    await this.storageService.clearUserData(userId);
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    if (!chatId || !userId) {
      throw new Error('Se requieren chatId y userId para eliminar un chat');
    }

    try {
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('El chat no existe');
      }
      
      const chatData = chatSnapshot.val();
      
      if (!chatData.participants.includes(userId)) {
        throw new Error('El usuario no es participante de este chat');
      }
      
      const userChatRef = ref(this.db, `userChats/${userId}/${chatId}`);
      await remove(userChatRef);
      
      const updates: any = {};
      updates[`chats/${chatId}/deletedBy/${userId}`] = true;
      await update(ref(this.db), updates);
      
      const otherUserId = chatData.participants.find((id: string) => id !== userId);
      if (otherUserId && chatData.deletedBy && chatData.deletedBy[otherUserId]) {
        await remove(ref(this.db, `messages/${chatId}`));
      }
      
      await this.storageService.deleteChatData(chatId, userId);
      this.chatDeleted$.next({chatId, userId});
      this.forceRefreshChats();
      console.log(`Chat ${chatId} eliminado para el usuario ${userId}`);
    } catch (error) {
      console.error('Error al eliminar chat:', error);
      throw new Error('No se pudo eliminar el chat');
    }
  }
}
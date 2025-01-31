import { Injectable } from '@angular/core';
import { Database, ref, push, set, onValue, get, update } from '@angular/fire/database';
import { Observable } from 'rxjs';

interface Message {
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  readBy: { [key: string]: boolean }; // New field to track who has read the message
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: number;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  constructor(private db: Database) {}

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
      const messagesRef = ref(this.db, `messages/${chatId}`);
      const newMessageRef = push(messagesRef);
      const message: Message = {
        content,
        senderId,
        senderName,
        timestamp: Date.now(),
        readBy: {
          [senderId]: true // Sender has read the message by default
        }
      };
      
      await set(newMessageRef, message);
      
      // Update chat with unread status for other participants
      const chatRef = ref(this.db, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      const chatData = chatSnapshot.val();
      
      // Mark message as unread for other participants
      const unreadStatus: { [key: string]: boolean } = {};
      chatData.participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          unreadStatus[participantId] = true;
        }
      });
  
      await set(chatRef, {
        ...chatData,
        lastMessage: content,
        lastMessageTimestamp: message.timestamp,
        unreadMessages: unreadStatus
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }
  
  // Add new method to mark messages as read
  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const messagesRef = ref(this.db, `messages/${chatId}`);
      const snapshot = await get(messagesRef);
      
      if (!snapshot.exists()) return;
      
      const updates: { [key: string]: any } = {};
      snapshot.forEach((childSnapshot) => {
        const message = childSnapshot.val();
        if (!message.readBy?.[userId]) {
          updates[`${childSnapshot.key}/readBy/${userId}`] = true;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await update(ref(this.db, `messages/${chatId}`), updates);
        
        // Clear unread status for this user in chat
        const chatRef = ref(this.db, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        const chatData = chatSnapshot.val();
        
        if (chatData.unreadMessages?.[userId]) {
          await update(chatRef, {
            [`unreadMessages/${userId}`]: false
          });
        }
      }
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

          subscriber.next(chats);
        } catch (error) {
          console.error('Error getting user chats:', error);
          subscriber.error(error);
        }
      });

      return () => unsubscribe();
    });
  }
}
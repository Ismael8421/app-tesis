import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

interface UserNameCache {
  [userId: string]: {
    name: string;
    timestamp: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChatStorageService {
  // Clave para almacenar la versión de la estructura de datos
  private readonly VERSION_KEY = 'chat_storage_version';
  private readonly CURRENT_VERSION = '1.0';
  
  // Claves para diferentes tipos de datos
  private readonly CHATS_KEY = 'user_chats';
  private readonly MESSAGES_PREFIX = 'chat_messages_';
  private readonly USER_NAMES_KEY = 'user_names_cache';
  
  // Tiempo de validez de los datos en caché (en milisegundos)
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
  
  constructor() {
    this.initStorage();
  }
  
  /**
   * Inicializa el almacenamiento y verifica/actualiza la versión
   */
  private async initStorage() {
    // Comprueba si estamos en una plataforma nativa
    if (!Capacitor.isNativePlatform()) {
      console.log('Usando almacenamiento web para el caché de chats');
    }
    
    try {
      const { value } = await Preferences.get({ key: this.VERSION_KEY });
      
      if (value !== this.CURRENT_VERSION) {
        console.log(`Actualizando almacenamiento de chats de ${value || 'ninguno'} a ${this.CURRENT_VERSION}`);
        // Si la versión ha cambiado, podríamos hacer migraciones aquí
        // Por ahora, simplemente limpiamos todo y establecemos la nueva versión
        await this.clearAllChatData();
        await Preferences.set({ key: this.VERSION_KEY, value: this.CURRENT_VERSION });
      }
    } catch (error) {
      console.error('Error inicializando almacenamiento:', error);
      // Establecer la versión inicial
      await Preferences.set({ key: this.VERSION_KEY, value: this.CURRENT_VERSION });
    }
  }
  
  /**
   * Guarda la lista de chats de un usuario
   */
  async saveUserChats(userId: string, chats: Chat[]): Promise<void> {
    if (!userId) return;
    
    try {
      const key = `${this.CHATS_KEY}_${userId}`;
      const data = {
        chats,
        timestamp: Date.now()
      };
      
      await Preferences.set({
        key,
        value: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Error guardando chats en almacenamiento local:', error);
    }
  }
  
  /**
   * Obtiene la lista de chats de un usuario
   */
  getUserChats(userId: string): Observable<Chat[]> {
    if (!userId) return of([]);
    
    return from(Preferences.get({ key: `${this.CHATS_KEY}_${userId}` })).pipe(
      map(result => {
        if (!result.value) return [];
        
        const data = JSON.parse(result.value);
        
        // Verificar si los datos son recientes
        if (Date.now() - data.timestamp > this.CACHE_TTL) {
          console.log('Datos de chats caducados, se requerirá recarga');
        }
        
        return data.chats as Chat[];
      }),
      catchError(err => {
        console.error('Error recuperando chats del almacenamiento:', err);
        return of([]);
      })
    );
  }
  
  /**
   * Guarda los mensajes de un chat específico
   */
  async saveChatMessages(chatId: string, messages: Message[]): Promise<void> {
    if (!chatId) return;
    
    try {
      const key = `${this.MESSAGES_PREFIX}${chatId}`;
      const data = {
        messages,
        timestamp: Date.now()
      };
      
      await Preferences.set({
        key,
        value: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Error guardando mensajes en almacenamiento local:', error);
    }
  }
  
  /**
   * Obtiene los mensajes de un chat específico
   */
  getChatMessages(chatId: string): Observable<Message[]> {
    if (!chatId) return of([]);
    
    return from(Preferences.get({ key: `${this.MESSAGES_PREFIX}${chatId}` })).pipe(
      map(result => {
        if (!result.value) return [];
        
        const data = JSON.parse(result.value);
        
        // Verificar si los datos son recientes
        if (Date.now() - data.timestamp > this.CACHE_TTL) {
          console.log('Datos de mensajes caducados, se requerirá recarga');
        }
        
        return data.messages as Message[];
      }),
      catchError(err => {
        console.error('Error recuperando mensajes del almacenamiento:', err);
        return of([]);
      })
    );
  }
  
  /**
   * Guarda los nombres de usuario en caché
   */
  async saveUserNames(userNames: { [key: string]: string }): Promise<void> {
    try {
      // Convertir a formato con timestamps
      const cacheData: UserNameCache = {};
      const now = Date.now();
      
      for (const [userId, name] of Object.entries(userNames)) {
        cacheData[userId] = {
          name,
          timestamp: now
        };
      }
      
      // Primero obtener los datos existentes
      const { value } = await Preferences.get({ key: this.USER_NAMES_KEY });
      let existingData: UserNameCache = {};
      
      if (value) {
        existingData = JSON.parse(value);
      }
      
      // Combinar con los datos nuevos
      const mergedData = { ...existingData, ...cacheData };
      
      await Preferences.set({
        key: this.USER_NAMES_KEY,
        value: JSON.stringify(mergedData)
      });
    } catch (error) {
      console.error('Error guardando nombres de usuario en caché:', error);
    }
  }
  
  /**
   * Obtiene los nombres de usuario desde la caché
   */
  async getUserNames(): Promise<{ [key: string]: string }> {
    try {
      const { value } = await Preferences.get({ key: this.USER_NAMES_KEY });
      
      if (!value) return {};
      
      const cacheData: UserNameCache = JSON.parse(value);
      const result: { [key: string]: string } = {};
      const now = Date.now();
      
      // Filtrar y convertir de vuelta al formato original
      for (const [userId, data] of Object.entries(cacheData)) {
        if (now - data.timestamp <= this.CACHE_TTL) {
          result[userId] = data.name;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error recuperando nombres de usuario de la caché:', error);
      return {};
    }
  }
  
  /**
   * Limpia los datos de un usuario específico
   */
  async clearUserData(userId: string): Promise<void> {
    if (!userId) return;
    
    try {
      await Preferences.remove({ key: `${this.CHATS_KEY}_${userId}` });
      
      // También podríamos eliminar los mensajes de los chats de este usuario,
      // pero necesitaríamos primero obtener la lista de chats
    } catch (error) {
      console.error('Error limpiando datos de usuario:', error);
    }
  }
  
  /**
   * Limpia todos los datos de chat almacenados
   */
  async clearAllChatData(): Promise<void> {
    try {
      const { keys } = await Preferences.keys();
      
      const chatKeys = keys.filter(key => 
        key.startsWith(this.CHATS_KEY) || 
        key.startsWith(this.MESSAGES_PREFIX) ||
        key === this.USER_NAMES_KEY
      );
      
      for (const key of chatKeys) {
        await Preferences.remove({ key });
      }
      
      console.log(`Eliminados ${chatKeys.length} registros de almacenamiento de chat`);
    } catch (error) {
      console.error('Error limpiando datos de chat:', error);
    }
  }
  
  /**
   * Actualiza los datos almacenados periódicamente
   */
  async pruneExpiredData(): Promise<void> {
    const now = Date.now();
    
    try {
      // Limpiar caché de nombres de usuario expirados
      const { value } = await Preferences.get({ key: this.USER_NAMES_KEY });
      
      if (value) {
        const cacheData: UserNameCache = JSON.parse(value);
        let modified = false;
        
        for (const userId in cacheData) {
          if (now - cacheData[userId].timestamp > this.CACHE_TTL) {
            delete cacheData[userId];
            modified = true;
          }
        }
        
        if (modified) {
          await Preferences.set({
            key: this.USER_NAMES_KEY,
            value: JSON.stringify(cacheData)
          });
        }
      }
      
      // También podríamos limpiar chats y mensajes antiguos aquí
    } catch (error) {
      console.error('Error limpiando datos expirados:', error);
    }
  }
}
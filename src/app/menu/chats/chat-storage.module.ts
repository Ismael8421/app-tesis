import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from './data-access/chat.service';
import { ChatStorageService } from './data-access/chat-storage.service';
import { NetworkService } from './data-access/network.service';
import { UserStatusService } from './data-access/userstatus.service';
import { NotificationService } from './data-access/notification.service';
import { Capacitor } from '@capacitor/core';

/**
 * Módulo que centraliza todos los servicios relacionados con chats
 * y configura la inicialización del almacenamiento local.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    ChatService,
    ChatStorageService,
    NetworkService,
    UserStatusService,
    NotificationService
  ]
})
export class ChatStorageModule {
  constructor(
    private storageService: ChatStorageService,
    private networkService: NetworkService,
    private notificationService: NotificationService
  ) {
    // Inicializar servicios
    this.initializeServices();
  }

  private async initializeServices() {
    // Eliminar datos expirados periódicamente (cada 12 horas)
    setInterval(() => {
      this.storageService.pruneExpiredData();
    }, 12 * 60 * 60 * 1000);
    
    // Inicializar notificaciones solo si estamos en plataforma nativa
    if (Capacitor.isNativePlatform()) {
      console.log('Inicializando servicios de notificación...');
      
      try {
        await this.notificationService.setupNotificationChannels();
        await this.notificationService.initPushNotifications();
        console.log('Servicios de notificación inicializados correctamente');
      } catch (error) {
        console.error('Error inicializando servicios de notificación:', error);
      }
    }
  }
}
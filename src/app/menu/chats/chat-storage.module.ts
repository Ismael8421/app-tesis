import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from './data-access/chat.service';
import { ChatStorageService } from './data-access/chat-storage.service';
import { NetworkService } from './data-access/network.service';
import { UserStatusService } from './data-access/userstatus.service';
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
    UserStatusService
  ]
})
export class ChatStorageModule {
  constructor(
    private storageService: ChatStorageService,
    private networkService: NetworkService,
  ) {
    // Inicializar servicios
    this.initializeServices();
  }

  private async initializeServices() {
    // Eliminar datos expirados periódicamente (cada 12 horas)
    setInterval(() => {
      this.storageService.pruneExpiredData();
    }, 12 * 60 * 60 * 1000);
  }
}
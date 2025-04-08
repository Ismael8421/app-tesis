import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { NotificationService } from './notification.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

interface NotificationPayload {
    title: string;
    body: string;
    data: {
      [key: string]: string;
    };
  }
  
  @Injectable({
    providedIn: 'root'
  })
  export class NotificationSenderService {
    private functions = inject(Functions);
    private auth = inject(Auth);
    private http = inject(HttpClient);
    private notificationService = inject(NotificationService);
    private userProfileService = inject(UserProfileService);
  
    constructor() {}
  
    /**
     * Envía una notificación de nuevo mensaje a un usuario
     */
    public sendMessageNotification(
      recipientId: string,
      chatId: string,
      message: string,
      senderName?: string
    ): Observable<boolean> {
      // Verificar si el usuario está autenticado
      if (!this.auth.currentUser) {
        console.error('No hay usuario autenticado para enviar notificación');
        return of(false);
      }
  
      // Obtener el nombre del remitente si no se proporciona
      return (senderName 
        ? of(senderName) 
        : this.userProfileService.getDisplayName(this.auth.currentUser.uid).pipe(take(1))
      ).pipe(
        switchMap(displayName => {
          // Preparar la carga de la notificación
          const payload: NotificationPayload = {
            title: `${displayName || 'Nuevo mensaje'}`,
            body: message.length > 100 ? message.substring(0, 97) + '...' : message,
            data: {
              type: 'message',
              chat_id: chatId,
              sender_id: this.auth.currentUser?.uid || '',
              sender_name: displayName || 'Usuario',
              timestamp: Date.now().toString()
            }
          };
  
          // Llamar a la función de Cloud Functions para enviar la notificación
          return this.sendNotificationViaCloudFunction(recipientId, payload);
        }),
        catchError(error => {
          console.error('Error enviando notificación de mensaje:', error);
          return of(false);
        })
      );
    }
  
    /**
     * Envía la notificación usando Cloud Functions
     */
    private sendNotificationViaCloudFunction(
      recipientId: string, 
      payload: NotificationPayload
    ): Observable<boolean> {
      try {
        // Referencia a la función de Cloud
        const sendNotification = httpsCallable(
          this.functions, 
          'sendNotification'
        );
  
        // Llamar a la función con los parámetros
        return from(sendNotification({
          recipientId,
          notification: payload
        })).pipe(
          map(result => {
            const response = result.data as any;
            return response.success === true;
          }),
          catchError(error => {
            console.error('Error llamando a Cloud Function:', error);
            return of(false);
          })
        );
      } catch (error) {
        console.error('Error configurando llamada a Cloud Function:', error);
        return of(false);
      }
    }
  
    /**
     * Método alternativo: Enviar a través de una API REST
     * (útil si prefieres implementar el servidor por separado)
     */
    private sendNotificationViaAPI(
      recipientId: string, 
      payload: NotificationPayload
    ): Observable<boolean> {
      const apiUrl = 'https://tu-api-de-notificaciones.com/send';
      
      const requestBody = {
        recipientId,
        notification: payload,
        senderInfo: {
          uid: this.auth.currentUser?.uid,
          appId: 'com.example.app'
        }
      };
      
      return this.http.post<{success: boolean}>(apiUrl, requestBody).pipe(
        map(response => response.success),
        catchError(error => {
          console.error('Error enviando notificación a través de API:', error);
          return of(false);
        })
      );
    }
  }
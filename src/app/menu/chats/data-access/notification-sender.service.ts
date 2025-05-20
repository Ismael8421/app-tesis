import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationSenderService {
  constructor() {}

  /**
   * Método obsoleto: Las notificaciones ahora se manejan en el backend por Cloud Functions
   */
  public sendMessageNotification(
    recipientId: string,
    chatId: string,
    message: string,
    senderName?: string
  ): Observable<boolean> {
    console.warn('Notificaciones manejadas por Cloud Functions en el backend');
    return of(true);
  }
}
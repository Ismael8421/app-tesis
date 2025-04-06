/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

Start writing functions
https://firebase.google.com/docs/functions/typescript
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
*/

/**
 * Import function triggers from their respective submodules
 */
import { onValueCreated } from "firebase-functions/v2/database";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import fetch from "node-fetch";

// Inicializar la app de Firebase Admin
initializeApp();

const db = getDatabase();
const ONESIGNAL_APP_ID = '1d2c69ba-1093-4b48-85a9-66d6ad9cbd78'; // Reemplazar con tu ID de OneSignal
const ONESIGNAL_REST_API_KEY = 'os_v2_app_duwgtoqqsnfurbnjm3lk3hf5pb4t5eycowlubxnnsjjou4frwwan6xkfmqzwdfmc5bbcnwrjn5whg4zquaesmabe4z3adgbeyaylfgq'; // Reemplazar con tu API Key de OneSignal

// Esta función se activa cuando se crea un nuevo documento en la colección 'notifications'
export const sendOneSignalNotification = onValueCreated({
  ref: '/notifications/{notificationId}',
  region: 'us-central1' // Puedes cambiar la región según tus necesidades
}, async (event) => {
  const notification = event.data.val();
  
  if (!notification || !notification.recipientPlayerId) {
    logger.info("No hay datos de notificación válidos");
    return null;
  }
  
  try {
    // Construir el payload para OneSignal
    const oneSignalPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [notification.recipientPlayerId],
      headings: { en: notification.title },
      contents: { en: notification.body },
      data: {
        chatId: notification.chatId,
        senderId: notification.senderId,
        type: notification.type
      },
      android_channel_id: "chat_messages", // ID del canal de notificación Android
      ios_sound: "notification.wav",  // Sonido para iOS
      android_sound: "notification"   // Sonido para Android (sin extensión)
    };
    
    // Enviar la notificación a OneSignal
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(oneSignalPayload)
    });
    
    const responseData = await response.json();
    
    if (response.ok) {
      logger.info('Notificación enviada exitosamente:', responseData);
      
      // Opcional: Actualizar el estado de la notificación
      await db.ref(`notifications/${event.params.notificationId}`).update({
        status: 'sent',
        oneSignalResponse: responseData
      });
      
      return responseData;
    } else {
      logger.error('Error enviando notificación:', responseData);
      
      // Actualizar el estado de error
      await db.ref(`notifications/${event.params.notificationId}`).update({
        status: 'error',
        error: responseData
      });
      
      throw new Error(`OneSignal API responded with error: ${JSON.stringify(responseData)}`);
    }
  } catch (error: unknown) { // Tipar explícitamente como unknown
    // Convertir el error a string de forma segura
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Error al enviar notificación:', error);
    
    await db.ref(`notifications/${event.params.notificationId}`).update({
      status: 'error',
      error: errorMessage // Usar la variable tipada de forma segura
    });
    
    return null;
  }
});
/**
 * Import function triggers from their respective submodules
 */
import {onValueCreated} from "firebase-functions/v2/database";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getDatabase} from "firebase-admin/database";
import {getMessaging} from "firebase-admin/messaging";

// Inicializar la app de Firebase Admin
initializeApp();

const db = getDatabase();
const messaging = getMessaging();

export const sendFCMNotification = onValueCreated({
  ref: "/notifications/{notificationId}",
  region: "us-central1",
}, async (event) => {
  const notification = event.data.val();

  if (!notification || !notification.recipientToken) {
    logger.info("No hay datos de notificación válidos");
    return null;
  }

  try {
    // Versión simplificada de mensaje FCM para evitar problemas de tipos
    const message = {
      token: notification.recipientToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      // Solo incluimos los datos básicos para minimizar problemas de tipos
      data: {
        chatId: notification.chatId || "",
        senderId: notification.senderId || "",
      },
    };

    // Enviar la notificación usando FCM
    const response = await messaging.send(message);

    logger.info("Notificación enviada exitosamente:", response);

    // Actualizar el estado de la notificación
    await db.ref(`notifications/${event.params.notificationId}`).update({
      status: "sent",
      fcmResponse: response,
    });

    return response;
  } catch (error: unknown) {
    // Convertir el error a string de forma segura
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Error al enviar notificación:", error);

    await db.ref(`notifications/${event.params.notificationId}`).update({
      status: "error",
      error: errorMessage,
    });

    return null;
  }
});

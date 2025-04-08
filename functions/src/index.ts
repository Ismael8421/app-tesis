import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

// Inicializar la aplicación de Firebase
admin.initializeApp();

// Define un tipo específico para tus datos de notificación
interface NotificationData {
  recipientId: string;
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
}

/**
 * Función Cloud para enviar notificaciones
 */
export const sendNotification = functionsV1.https.onCall(
  async (data: NotificationData, context) => {
    // Verificar si el usuario está autenticado
    if (!context.auth) {
      throw new functionsV1.https.HttpsError(
        "unauthenticated",
        "El usuario debe estar autenticado para enviar notificaciones"
      );
    }

    // Verificar que se proporcionaron todos los datos necesarios
    if (!data.recipientId || !data.notification) {
      throw new functionsV1.https.HttpsError(
        "invalid-argument",
        "Se requiere recipientId y notification"
      );
    }

    try {
      // Obtener tokens de dispositivo del destinatario
      const userDevicesRef = admin.database().ref(`userDevices/${data.recipientId}`);
      const snapshot = await userDevicesRef.once("value");

      if (!snapshot.exists()) {
        console.log(`No hay dispositivos registrados para el usuario ${data.recipientId}`);
        return {success: false, message: "No devices registered"};
      }

      const devices = snapshot.val();
      const tokens: string[] = [];

      // Recopilar tokens activos
      Object.values(devices).forEach((device: any) => {
        if (device.active && device.token) {
          tokens.push(device.token);
        }
      });

      if (tokens.length === 0) {
        console.log(`No hay tokens activos para el usuario ${data.recipientId}`);
        return {success: false, message: "No active tokens"};
      }

      // Preparar la notificación
      const notification: admin.messaging.MulticastMessage = {
        notification: {
          title: data.notification.title,
          body: data.notification.body,
        },
        data: data.notification.data || {},
        tokens: tokens, // Enviar a múltiples dispositivos
        android: {
          notification: {
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            channelId: "messages",
            priority: "high" as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
            },
          },
          headers: {
            "apns-priority": "10",
          },
        },
      };

      // Enviar la notificación
      const response = await admin.messaging().sendMulticast(notification);

      console.log(`${response.successCount} notificaciones enviadas exitosamente`);

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      console.error("Error enviando notificación:", error);
      throw new functionsV1.https.HttpsError(
        "internal",
        "Error enviando notificación",
        error as Error
      );
    }
  }
);

/**
 * Función para enviar notificación cuando se crea un nuevo mensaje
 * Esta función se activa automáticamente cuando se añade un nuevo mensaje
 */
export const onNewMessage = functionsV1.database
  .ref("/messages/{chatId}/{messageId}")
  .onCreate(async (snapshot, context) => {
    const message = snapshot.val();
    const {chatId, messageId} = context.params;

    // No enviar notificación si no hay remitente o contenido
    if (!message || !message.senderId || !message.content) {
      console.log("Mensaje incompleto, no se enviará notificación");
      return null;
    }

    try {
      // Obtener datos del chat para encontrar a los participantes
      const chatSnapshot = await admin.database().ref(`/chats/${chatId}`).once("value");

      if (!chatSnapshot.exists()) {
        console.log(`El chat ${chatId} no existe`);
        return null;
      }

      const chat = chatSnapshot.val();

      // No continuar si no hay participantes
      if (!chat.participants || !Array.isArray(chat.participants)) {
        console.log("No hay participantes en el chat");
        return null;
      }

      // Enviar notificación a todos los participantes excepto al remitente
      const senderId = message.senderId;
      const senderName = message.senderName || "Usuario";

      const recipientPromises = chat.participants
        .filter((participantId: string) => participantId !== senderId)
        .map(async (recipientId: string) => {
          // Verificar si el usuario ha eliminado el chat
          if (chat.deletedBy && chat.deletedBy[recipientId]) {
            console.log(`El usuario ${recipientId} ha eliminado el chat, no se enviará notificación`);
            return;
          }

          // Obtener tokens del usuario
          const userDevicesRef = admin.database().ref(`userDevices/${recipientId}`);
          const devicesSnapshot = await userDevicesRef.once("value");

          if (!devicesSnapshot.exists()) {
            console.log(`No hay dispositivos para el usuario ${recipientId}`);
            return;
          }

          const devices = devicesSnapshot.val();
          const tokens: string[] = [];

          // Filtrar solo tokens activos
          Object.values(devices).forEach((device: any) => {
            if (device.active && device.token) {
              tokens.push(device.token);
            }
          });

          if (tokens.length === 0) {
            console.log(`No hay tokens activos para ${recipientId}`);
            return;
          }

          // Preparar y enviar notificación
          const notificationPayload: admin.messaging.MulticastMessage = {
            notification: {
              title: senderName,
              body: message.content.length > 100 ?
                message.content.substring(0, 97) + "..." :
                message.content,
            },
            data: {
              type: "message",
              chat_id: chatId,
              message_id: messageId,
              sender_id: senderId,
              sender_name: senderName,
              timestamp: message.timestamp ? message.timestamp.toString() : Date.now().toString(),
            },
            tokens: tokens,
            android: {
              notification: {
                sound: "default",
                channelId: "messages",
                priority: "high" as const,
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          };

          return admin.messaging().sendMulticast(notificationPayload);
        });

      await Promise.all(recipientPromises);
      return null;
    } catch (error) {
      console.error("Error enviando notificación para nuevo mensaje:", error);
      return null;
    }
  });

/**
 * Función para limpiar tokens inactivos periódicamente
 * Se ejecuta una vez al día
 */
export const cleanupInactiveTokens = functionsV1.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const userDevicesRef = admin.database().ref("userDevices");

      // Obtener todos los dispositivos
      const snapshot = await userDevicesRef.once("value");

      if (!snapshot.exists()) {
        console.log("No hay dispositivos registrados");
        return null;
      }

      const updates: {[path: string]: null} = {};
      let deletedCount = 0;

      // Recorrer usuarios y sus dispositivos
      snapshot.forEach((userSnapshot) => {
        const userId = userSnapshot.key;
        if (!userId) return;

        userSnapshot.forEach((deviceSnapshot) => {
          const deviceId = deviceSnapshot.key;
          if (!deviceId) return;

          const device = deviceSnapshot.val();

          // Eliminar tokens inactivos por más de un mes
          if (
            !device.active &&
            device.lastLogout &&
            device.lastLogout < oneMonthAgo
          ) {
            updates[`${userId}/${deviceId}`] = null;
            deletedCount++;
          }
        });
      });

      // Aplicar actualizaciones si hay algo que eliminar
      if (deletedCount > 0) {
        await userDevicesRef.update(updates);
        console.log(`Se eliminaron ${deletedCount} tokens inactivos`);
      } else {
        console.log("No se encontraron tokens inactivos para eliminar");
      }

      return null;
    } catch (error) {
      console.error("Error limpiando tokens inactivos:", error);
      return null;
    }
  });

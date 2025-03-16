/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendNotification = functions.database.ref("/notifications/{notificationId}")
    .onCreate(async (snapshot, context) => {
      try {
        const notificationData = snapshot.val();

        if (!notificationData || !notificationData.recipientToken) {
          console.log("No valid notification data found");
          return null;
        }

        // Datos de la notificación
        const message = {
          token: notificationData.recipientToken,
          notification: {
            title: notificationData.title || "Nuevo mensaje",
            body: notificationData.body || "Tienes un nuevo mensaje",
          },
          data: {
            chatId: notificationData.chatId || "",
            timestamp: (notificationData.timestamp && notificationData.timestamp.toString()) || Date.now().toString(),
            notificationType: "chat_message",
          },
          android: {
            notification: {
              icon: "ic_notification",
              color: "#4CAF50",
              priority: "high",
              channelId: "chat_messages",
              clickAction: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default",
              },
            },
            fcmOptions: {
              imageUrl: notificationData.imageUrl || null,
            },
          },
        };

        // Enviar la notificación
        const response = await admin.messaging().send(message);
        console.log("Notification sent successfully:", response);

        // Eliminar la notificación de la base de datos después de enviarla
        await snapshot.ref.remove();

        return response;
      } catch (error) {
        console.error("Error sending notification:", error);
        return null;
      }
    });

// Función para limpiar notificaciones antiguas periódicamente
exports.cleanupNotifications = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
  try {
    const timeThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
    const notificationsRef = admin.database().ref("/notifications");

    // Consultar notificaciones antiguas
    const snapshot = await notificationsRef.orderByChild("timestamp").endAt(timeThreshold).once("value");

    // Eliminar las notificaciones antiguas
    const updates = {};
    snapshot.forEach((childSnapshot) => {
      updates[childSnapshot.key] = null;
    });

    if (Object.keys(updates).length > 0) {
      await notificationsRef.update(updates);
      console.log(`Deleted ${Object.keys(updates).length} old notifications`);
    }

    return null;
  } catch (error) {
    console.error("Error cleaning up notifications:", error);
    return null;
  }
});

// Función para guardar/actualizar tokens de dispositivo cuando un usuario inicia sesión
exports.updateDeviceToken = functions.database.ref("/deviceTokens/{userId}")
    .onWrite(async (change, context) => {
      try {
        const userId = context.params.userId;
        const tokenData = change.after.val();

        if (!tokenData) {
          console.log("No token data found");
          return null;
        }

        // Extraer el token dependiendo de si es un string directo o un objeto
        let token;
        if (typeof tokenData === "string") {
          token = tokenData;
        } else if (tokenData.token) {
          token = tokenData.token;
        } else {
          console.log("No valid token found in data");
          return null;
        }

        // Puedes hacer validaciones adicionales del token o registrarlo en tus sistemas
        console.log(`Updated token for user ${userId}: ${token}`);

        return null;
      } catch (error) {
        console.error("Error handling token update:", error);
        return null;
      }
    });

// Ejemplo de la función onRequest comentada en el código original
// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import {
  onValueCreated,
  DatabaseEvent,
  DataSnapshot,
} from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

// Inicializar Firebase Admin
admin.initializeApp();

// Inicializar Realtime Database
const db = admin.database();

export const onMessageCreated = onValueCreated(
  {
    instance: "base-datos-f12f5-default-rtdb",
    ref: "/chats/{chatId}/messages/{messageId}",
  },
  async (event: DatabaseEvent<DataSnapshot>) => {
    const snapshot = event.data;
    const message = snapshot.val();
    const chatId = event.params.chatId;

    // Obtener detalles del chat
    const chatSnapshot = await db.ref(`chats/${chatId}`).once("value");
    const chat = chatSnapshot.val();
    if (!chat || !chat.participants) {
      console.error("Chat o participantes no encontrados");
      return;
    }

    // Función para encontrar al destinatario
    const isNotSender = (uid: string) => uid !== message.senderId;
    const recipientId = chat.participants.find(isNotSender);
    if (!recipientId) {
      console.error("Destinatario no encontrado");
      return;
    }

    // Obtener el token FCM del destinatario
    const tokenRef = db.ref(`fcmTokens/${recipientId}/token`);
    const tokenSnapshot = await tokenRef.once("value");

    const recipientToken = tokenSnapshot.val();
    if (!recipientToken) {
      console.log(`No se encontró token FCM para el usuario ${recipientId}`);
      return;
    }

    // Definir el payload de la notificación
    const payload = {
      notification: {
        title: "Nuevo mensaje",
        body: "Tienes un mensaje nuevo, revísalo.",
        icon: "/assets/icon/favicon.png",
      },
      data: {
        chatId: chatId,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      token: recipientToken,
    };

    try {
      // Enviar la notificación
      await admin.messaging().send(payload);
      console.log(`Notificación enviada al usuario ${recipientId}`);
    } catch (error) {
      console.error("Error al enviar la notificación:", error);
    }
  }
);

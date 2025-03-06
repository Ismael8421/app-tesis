/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendNotification = functions.database.ref('/notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    try {
      const notification = snapshot.val();
      
      if (!notification.recipientToken) {
        console.log('No recipient token found');
        return null;
      }
      
      // Crear el mensaje de notificación
      const message = {
        token: notification.recipientToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          chatId: notification.chatId,
          timestamp: notification.timestamp.toString()
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#4285F4',
            priority: 'high',
            channelId: 'chat_messages'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default'
            }
          }
        }
      };
      
      // Enviar la notificación
      const response = await admin.messaging().send(message);
      console.log('Successfully sent notification:', response);
      
      // Eliminar la notificación de la base de datos después de enviarla
      await snapshot.ref.remove();
      
      return null;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  });
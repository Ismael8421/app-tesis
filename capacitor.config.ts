import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'app-tesis',
  webDir: 'dist/app-tesis/browser',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'accounts.google.com',
      'apis.google.com',
      '*.firebaseapp.com',
      '*.googleapis.com',
      'onesignal.com'
    ],
    cleartext: true
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com']
    },
    // Configuración de notificaciones push
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    // Configuración de notificaciones locales
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#4CAF50",
      sound: "notification_sound.wav" 
    },
    // Configuración de Firebase Cloud Messaging
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
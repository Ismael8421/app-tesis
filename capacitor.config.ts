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
    },
    // Configuración del splash screen
    SplashScreen: {
      launchShowDuration: 3000, // Duración en milisegundos
      launchAutoHide: true,
      backgroundColor: "#4CAF50", // Color de fondo
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false, // Ponemos false porque usaremos nuestro spinner personalizado
      androidSpinnerStyle: "large",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen", // Nombre del layout personalizado
      spinnerColor: "#FFFFFF" // Color del spinner nativo (por si acaso)
    }
  },
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#4CAF50" // Color de fondo consistente con el splash
  }
};

export default config;
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'app-tesis',
  webDir: 'dist/app-tesis/browser',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
    cleartext: true // Permite conexiones sin HTTPS durante desarrollo
  },
  plugins: {
    // Aquí puedes añadir configuraciones de plugins específicos si los necesitas
  },
  // Esta configuración es clave para que las redirecciones de autenticación funcionen correctamente
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
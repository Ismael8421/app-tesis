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
      '*.googleapis.com'
    ],
    cleartext: true
  },
  plugins: {},
  ios: {
    contentInset: 'always'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
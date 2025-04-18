import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { getMessaging, provideMessaging } from '@angular/fire/messaging';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideHttpClient } from '@angular/common/http';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { UserActivityService } from './menu/shared/data-access/user-activity.service';
import { NetworkService } from './services/network.service';

const firebaseConfig = {
  apiKey: "AIzaSyDWICQxQQutJ-7t3hjIZP9QRuhtszoNkM8",
  authDomain: "base-datos-f12f5.firebaseapp.com",
  databaseURL: "https://base-datos-f12f5-default-rtdb.firebaseio.com",
  projectId: "base-datos-f12f5",
  storageBucket: "base-datos-f12f5.firebasestorage.app",
  messagingSenderId: "649337349797",
  appId: "1:649337349797:web:6790307f6f4800003d8f4c"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes), 
    provideFirebaseApp(() => initializeApp(firebaseConfig)), 
    provideAuth(() => getAuth()), 
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()), 
    provideFunctions(() => getFunctions()), // Añadido el proveedor de Functions
    provideIonicAngular({}),
    provideMessaging(() => getMessaging()), 
    provideStorage(() => getStorage()),
    provideHttpClient(),
    UserActivityService,
    NetworkService
  ]
};
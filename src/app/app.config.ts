import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideFirebaseApp(() => initializeApp({"projectId":"base-datos-ad943","appId":"1:1090314566944:web:569f5f71e406077db2eb45","storageBucket":"base-datos-ad943.firebasestorage.app","apiKey":"AIzaSyC1Njm1p5d7PKieXz3rswGhnj3Gwc8wMb8","authDomain":"base-datos-ad943.firebaseapp.com","messagingSenderId":"1090314566944"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())]
};

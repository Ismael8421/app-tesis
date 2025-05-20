importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDWICQxQQutJ-7t3hjIZP9QRuhtszoNkM8',
  authDomain: 'base-datos-f12f5.firebaseapp.com',
  databaseURL: 'https://base-datos-f12f5-default-rtdb.firebaseio.com',
  projectId: 'base-datos-f12f5',
  storageBucket: 'base-datos-f12f5.firebasestorage.app',
  messagingSenderId: '649337349797',
  appId: '1:649337349797:web:6790307f6f4800003d8f4c',
  measurementId: 'G-ERHJF9PZPL'
});

const messaging = firebase.messaging();
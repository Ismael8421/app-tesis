// src/environments/environment.ts
export const environment = {
    production: false,
    firebase: {
      apiKey: "AIzaSyDWICQxQQutJ-7t3hjIZP9QRuhtszoNkM8",
      authDomain: "base-datos-f12f5.firebaseapp.com",
      databaseURL: "https://base-datos-f12f5-default-rtdb.firebaseio.com",
      projectId: "base-datos-f12f5",
      storageBucket: "base-datos-f12f5.firebasestorage.app",
      messagingSenderId: "649337349797",
      appId: "1:649337349797:web:6790307f6f4800003d8f4c",
      measurementId: "G-ERHJF9PZPL",
      vapidKey: 'BJ0Y_YMezCCTByipOgEsIKTFmxF_c81e7jZrvUgiK9_5cE6I9JjaOhb1zTnUisSmtsjC6cGPf6Z-6QlpfRhUCPI'// Replace with your actual VAPID key from the image
    },
    cloudinary: {
      cloudName: 'dxic2qdto',  // Reemplaza con tu Cloud Name de Cloudinary
      uploadPreset: 'profile_images_preset', // Reemplaza con tu Upload Preset (debe ser unsigned)
      apiKey: '791529778122864' // Opcional, solo si necesitas operaciones firmadas
    }
  };
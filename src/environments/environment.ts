// src/environments/environment.ts
export const environment = {
    production: false,
    firebase: {
      // Aquí tus configuraciones de Firebase
    },
    cloudinary: {
      cloudName: 'dxic2qdto',  // Reemplaza con tu Cloud Name de Cloudinary
      uploadPreset: 'profile_images_preset', // Reemplaza con tu Upload Preset (debe ser unsigned)
      apiKey: '791529778122864' // Opcional, solo si necesitas operaciones firmadas
    }
  };
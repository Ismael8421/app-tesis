// src/app/menu/configs/profile/profile-image.service.ts
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ProfileImageService {
    private readonly USER_PROFILE_IMAGE_KEY = 'user_profile_image';

    constructor() { }

    /**
     * Guarda la imagen de perfil en localStorage (temporal)
     * Esto será reemplazado por Firebase Storage más adelante
     */
    saveProfileImage(userId: string, imageDataUrl: string): void {
        try {
            // Guardar en localStorage por ahora
            localStorage.setItem(`${this.USER_PROFILE_IMAGE_KEY}_${userId}`, imageDataUrl);
            console.log('Imagen de perfil guardada localmente');
        } catch (error) {
            console.error('Error al guardar imagen de perfil:', error);
            throw error;
        }
    }

    /**
     * Obtiene la imagen de perfil del localStorage (temporal)
     * Esto será reemplazado por Firebase Storage más adelante
     */
    getProfileImage(userId: string): string | null {
        try {
            return localStorage.getItem(`${this.USER_PROFILE_IMAGE_KEY}_${userId}`);
        } catch (error) {
            console.error('Error al obtener imagen de perfil:', error);
            return null;
        }
    }

    /**
     * Implementación futura para subir imagen a Firebase Storage
     * Este método estará disponible para cuando actualices tu plan de Firebase
     */
    async uploadProfileImageToFirebase(userId: string, imageDataUrl: string): Promise<string> {
        // Esta es una implementación ficticia
        // Se reemplazará cuando implementes Firebase Storage

        // Simular carga a Firebase
        await new Promise(resolve => setTimeout(resolve, 500));

        // Guardar localmente mientras tanto
        this.saveProfileImage(userId, imageDataUrl);

        // Retornar una URL ficticia
        return `https://firebase-storage-url.example.com/users/${userId}/profile.jpg`;
    }

    /**
     * Genera una versión recortada circular de la imagen
     * usando Canvas para un recorte real
     * 
     * @param imageUrl URL de la imagen original
     * @param offsetX Desplazamiento X
     * @param offsetY Desplazamiento Y
     * @param zoom Nivel de zoom
     * @returns Promise con la imagen recortada como Data URL
     */
    getCircularDisplayUrl(squareImageUrl: string): string {
        return squareImageUrl; // La URL es la misma, solo cambia el CSS de visualización
    }

    async optimizeProfileImage(imageDataUrl: string, maxSize: number = 500): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    // Determinar las dimensiones adecuadas manteniendo proporciones
                    let targetWidth = img.width;
                    let targetHeight = img.height;

                    // Si cualquier dimensión excede el máximo, redimensionar
                    if (targetWidth > maxSize || targetHeight > maxSize) {
                        if (targetWidth > targetHeight) {
                            targetHeight = (targetHeight / targetWidth) * maxSize;
                            targetWidth = maxSize;
                        } else {
                            targetWidth = (targetWidth / targetHeight) * maxSize;
                            targetHeight = maxSize;
                        }
                    }

                    // Crear canvas con las nuevas dimensiones
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('No se pudo crear el contexto 2D'));
                        return;
                    }

                    // Dibujar la imagen redimensionada
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                    // Convertir a JPEG con calidad optimizada
                    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    // Verificar que el tamaño se ha reducido
                    const originalSize = imageDataUrl.length * 0.75; // Aproximación
                    const optimizedSize = optimizedDataUrl.length * 0.75;

                    console.log('Optimización de imagen:', {
                        originalDimensions: { width: img.width, height: img.height },
                        newDimensions: { width: targetWidth, height: targetHeight },
                        originalSize: `${Math.round(originalSize / 1024)} KB`,
                        optimizedSize: `${Math.round(optimizedSize / 1024)} KB`,
                        reduction: `${Math.round((1 - optimizedSize / originalSize) * 100)}%`
                    });

                    resolve(optimizedDataUrl);
                } catch (error) {
                    console.error('Error optimizando imagen:', error);
                    // En caso de error, devolver la imagen original
                    resolve(imageDataUrl);
                }
            };

            img.onerror = () => {
                reject(new Error('Error al cargar la imagen para optimizar'));
            };

            img.src = imageDataUrl;
        });
    }

    // Añadir al ProfileImageService.ts
    async simpleCropToCircle(imageUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    const size = 300;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('No se pudo crear el contexto 2D'));
                        return;
                    }

                    // Crear un recorte circular
                    ctx.beginPath();
                    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();

                    // Determinar dimensiones
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;

                    // Recortar un cuadrado del centro de la imagen
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                    resolve(dataUrl);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Error al cargar la imagen'));
            };

            img.src = imageUrl;
        });
    }
}
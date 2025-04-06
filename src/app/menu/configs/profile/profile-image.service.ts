// src/app/menu/configs/profile/profile-image.service.ts
import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, getDoc } from '@angular/fire/firestore';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ProfileImageService {
    private readonly USER_PROFILE_IMAGE_KEY = 'user_profile_image';
    private readonly PROFILE_IMAGE_FIELD = 'profileImageUrl';

    constructor(
        private firestore: Firestore,
        private cloudinaryService: CloudinaryService
    ) { }

    /**
     * Guarda la imagen de perfil en localStorage (temporal) y en Cloudinary
     * @param userId ID del usuario
     * @param imageDataUrl Imagen en formato Data URL
     */
    async saveProfileImage(userId: string, imageDataUrl: string): Promise<string> {
        try {
            // Guardar en localStorage por ahora (para respuesta inmediata)
            localStorage.setItem(`${this.USER_PROFILE_IMAGE_KEY}_${userId}`, imageDataUrl);
            
            // Subir a Cloudinary
            const cloudinaryResponse = await firstValueFrom(
                this.cloudinaryService.uploadImage(imageDataUrl, `profile_images/${userId}`)
            );
            
            // Extraer URL segura de Cloudinary
            const secureUrl = cloudinaryResponse.secure_url;
            
            // Guardar URL en Firestore
            await this.saveProfileImageUrlToFirestore(userId, secureUrl, cloudinaryResponse.public_id);
            
            console.log('Imagen de perfil guardada en Cloudinary:', secureUrl);
            return secureUrl;
        } catch (error) {
            console.error('Error al guardar imagen de perfil:', error);
            throw error;
        }
    }

    /**
     * Guarda la URL de la imagen de perfil en Firestore
     */
    private async saveProfileImageUrlToFirestore(
        userId: string, 
        imageUrl: string, 
        publicId: string
    ): Promise<void> {
        try {
            // Referencia al documento del usuario
            const userRef = doc(this.firestore, 'usuarios', userId);
            
            // Actualizar el campo de imagen de perfil
            await updateDoc(userRef, {
                [this.PROFILE_IMAGE_FIELD]: imageUrl,
                profileImagePublicId: publicId,
                profileImageUpdatedAt: new Date().toISOString()
            });
            
            console.log('URL de imagen guardada en Firestore');
        } catch (error) {
            console.error('Error al guardar URL en Firestore:', error);
            throw error;
        }
    }

    /**
     * Obtiene la imagen de perfil, primero del localStorage y luego de Firestore si es necesario
     */
    async getProfileImage(userId: string): Promise<string | null> {
        try {
            // Primero intentamos obtener del localStorage (para respuesta rápida)
            const localImage = localStorage.getItem(`${this.USER_PROFILE_IMAGE_KEY}_${userId}`);
            
            if (localImage) {
                return localImage;
            }
            
            // Si no está en localStorage, la buscamos en Firestore
            const userDoc = await getDoc(doc(this.firestore, 'usuarios', userId));
            
            if (userDoc.exists() && userDoc.data()[this.PROFILE_IMAGE_FIELD]) {
                const imageUrl = userDoc.data()[this.PROFILE_IMAGE_FIELD];
                
                // Guardamos en localStorage para acelerar futuras solicitudes
                localStorage.setItem(`${this.USER_PROFILE_IMAGE_KEY}_${userId}`, imageUrl);
                
                return imageUrl;
            }
            
            return null;
        } catch (error) {
            console.error('Error al obtener imagen de perfil:', error);
            return null;
        }
    }

    /**
     * Obtiene la URL optimizada para mostrar la imagen de perfil
     */
    getOptimizedProfileImageUrl(imageUrl: string, size: number = 300): string {
        if (!imageUrl) {
            return 'https://img.freepik.com/vector-premium/vector-dibujos-animados-icono-galleta-cuadrada-comida-galleta-azucar-dulce_98402-61270.jpg';
        }
        
        return this.cloudinaryService.getOptimizedUrl(imageUrl, size, size);
    }

    /**
     * Genera una versión recortada circular de la imagen
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
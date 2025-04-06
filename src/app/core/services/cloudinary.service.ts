// src/app/core/services/cloudinary.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private readonly CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/';
  private readonly UPLOAD_PRESET = environment.cloudinary.uploadPreset;
  private readonly CLOUD_NAME = environment.cloudinary.cloudName;

  constructor(private http: HttpClient) { }

  /**
   * Sube una imagen a Cloudinary
   * @param file Archivo de imagen (Blob, File o String en base64)
   * @param folder Carpeta donde se almacenará la imagen
   * @returns Observable con la respuesta de Cloudinary
   */
  uploadImage(file: Blob | File | string, folder: string = 'profile_images'): Observable<any> {
    // Crear FormData para enviar la imagen
    const formData = new FormData();
    
    // Si es string base64, necesitamos convertirlo
    if (typeof file === 'string' && file.includes('base64')) {
      // Ya está en formato base64, solo lo añadimos
      formData.append('file', file);
    } else {
      // Es un blob o un archivo
      formData.append('file', file);
    }
    
    // Añadir parámetros para Cloudinary
    formData.append('upload_preset', this.UPLOAD_PRESET);
    formData.append('folder', folder);
    
    // URL completa de carga
    const uploadUrl = `${this.CLOUDINARY_UPLOAD_URL}${this.CLOUD_NAME}/image/upload`;
    
    // Realizar la carga
    return this.http.post(uploadUrl, formData);
  }

  /**
   * Elimina una imagen de Cloudinary utilizando su public_id
   * Nota: Esto requiere firmado y generalmente se hace desde el backend
   * Esta función es un placeholder - normalmente necesitarías un endpoint en tu backend
   */
  deleteImage(publicId: string): Observable<any> {
    // Esta implementación es un ejemplo, necesitarás un backend para esto
    // debido a que necesitas una firma para eliminar recursos
    
    // Ejemplo de cómo sería con un backend:
    // return this.http.delete(`tu-api-backend/cloudinary/delete/${publicId}`);
    
    // Como placeholder, retornamos un Observable que completa inmediatamente
    return from(Promise.resolve({ result: 'success' }));
  }

  /**
   * Transforma una URL para aplicar optimizaciones y transformaciones
   * @param url URL original de Cloudinary
   * @param width Ancho deseado
   * @param height Alto deseado
   * @returns URL transformada
   */
  getOptimizedUrl(url: string, width: number = 300, height: number = 300): string {
    if (!url || !url.includes('cloudinary.com')) {
      return url; // No es una URL de Cloudinary, retornar sin cambios
    }

    // Ejemplo de transformación para imágenes de perfil (círcular, optimizada)
    // Formato: https://res.cloudinary.com/cloud_name/image/upload/c_fill,g_face,w_300,h_300,r_max/v1/path
    const parts = url.split('/upload/');
    if (parts.length !== 2) return url;

    return `${parts[0]}/upload/c_fill,g_face,w_${width},h_${height},r_max/${parts[1]}`;
  }
}
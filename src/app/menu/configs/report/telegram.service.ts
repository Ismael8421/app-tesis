import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TelegramService {
  private readonly botToken = '7895540522:AAEXzBYBShB1ZBfTemhXnAjx6mTFtdCmoQw';
  private readonly chatId = '6510888149';
  private readonly telegramBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
  
  // API Key para ImgBB - Obtenla registrándote en https://api.imgbb.com/
  private readonly imgbbApiKey = '69999c12ef11ffc1bb25b5a73eec2f95';
  private readonly imgbbBaseUrl = 'https://api.imgbb.com/1/upload';

  constructor(private http: HttpClient) {}

  /**
   * Envía un mensaje a Telegram con una imagen opcional
   * @param message Texto del mensaje
   * @param imageBase64 Imagen en formato base64 (opcional)
   */
  async sendMessage(message: string, imageBase64?: string): Promise<any> {
    try {
      // Si hay imagen, primero la subimos a ImgBB
      if (imageBase64) {
        try {
          const imageUrl = await this.uploadImageToImgBB(imageBase64);
          
          // Crear el mensaje con el enlace de la imagen
          const fullMessage = `${message}\n\n<a href="${imageUrl}">Ver captura adjunta</a>`;
          
          // Enviar mensaje con enlace a la imagen
          return await this.sendTextToTelegram(fullMessage);
        } catch (imageError) {
          console.warn('Error al subir la imagen:', imageError);
          // Si falla la carga de la imagen, enviamos solo el texto con una nota
          const fallbackMessage = `${message}\n\n[No se pudo cargar la imagen adjunta]`;
          return await this.sendTextToTelegram(fallbackMessage);
        }
      } else {
        // Enviar solo texto si no hay imagen
        return await this.sendTextToTelegram(message);
      }
    } catch (error) {
      console.error('Error enviando mensaje a Telegram:', error);
      throw error;
    }
  }

  /**
   * Sube una imagen a ImgBB y devuelve la URL
   * @param imageBase64 Imagen en formato base64
   * @returns URL de la imagen subida
   */
  private async uploadImageToImgBB(imageBase64: string): Promise<string> {
    // Crear FormData para la petición
    const formData = new FormData();
    formData.append('key', this.imgbbApiKey);
    formData.append('image', imageBase64);

    // Hacer la petición a ImgBB
    const response: any = await firstValueFrom(
      this.http.post(this.imgbbBaseUrl, formData)
    );

    // Verificar la respuesta
    if (response.success && response.data && response.data.url) {
      return response.data.url;
    } else {
      throw new Error('Error al subir la imagen a ImgBB');
    }
  }

  /**
   * Envía un mensaje de texto a Telegram
   * @param text Texto del mensaje
   */
  private async sendTextToTelegram(text: string): Promise<any> {
    const url = `${this.telegramBaseUrl}/sendMessage`;
    return await firstValueFrom(
      this.http.post(url, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML'
      })
    );
  }
}
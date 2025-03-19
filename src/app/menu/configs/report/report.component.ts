import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Auth } from '@angular/fire/auth';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { TelegramService } from './telegram.service';
import { HttpClientModule } from '@angular/common/http';
import { 
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonItem, IonLabel, IonTextarea, IonText, IonSpinner,
  IonIcon
} from '@ionic/angular/standalone';
import { ThemeService } from '../settings/data-access/theme.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import { 
  imageOutline, 
  trashOutline,
  cameraOutline
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    HttpClientModule,
    BackIconComponent,
    IonContent, 
    IonCard, 
    IonCardHeader, 
    IonCardTitle, 
    IonCardContent,
    IonButton, 
    IonItem, 
    IonLabel, 
    IonTextarea,
    IonText,
    IonSpinner,
    IonIcon
  ],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss']
})
export class ReportComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private auth = inject(Auth);
  private telegramService = inject(TelegramService);
  private themeService = inject(ThemeService);
  
  reportForm!: FormGroup;
  isSubmitting = false;
  fileName = '';
  imagePreview: string | null = null;
  loading = false;
  errorMessage = '';

  constructor() {
    addIcons({
      'image-outline': imageOutline,
      'trash-outline': trashOutline,
      'camera-outline': cameraOutline
    });

    // Suscribirse a cambios de tema
    this.themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        // El ThemeService ya maneja la aplicación de la clase .dark al body
      });
  }

  ngOnInit() {
    this.initForm();
    this.checkPermissions();
  }

  initForm() {
    this.reportForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  navigateBack() {
    this.router.navigateByUrl('/menu/configuraciones');
  }

  async checkPermissions() {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
          await Camera.requestPermissions();
        }
      } catch (error) {
        console.log('Verificación de permisos omitida en web:', error);
      }
    }
  }

  async captureImage() {
    this.errorMessage = '';
    this.loading = true;
    
    try {
      // Configuración de la cámara similar a tu proyecto funcional
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,  // Usar galería/fotos en lugar de cámara directa
        webUseInput: true,  // Importante para web - abre el explorador de archivos
        saveToGallery: false
      });

      if (image && image.dataUrl) {
        console.log('Imagen capturada correctamente');
        this.imagePreview = image.dataUrl;
        this.fileName = 'Imagen seleccionada';
      } else {
        console.warn('No se pudo obtener la imagen');
        this.errorMessage = 'No se pudo obtener la imagen';
      }
    } catch (error) {
      console.error('Error al capturar la imagen:', error);
      
      // Manejo específico para diferentes tipos de errores
      if (error instanceof Error) {
        // Si el usuario canceló la selección
        if (error.message.includes('User cancelled')) {
          console.log('El usuario canceló la selección');
          // No mostramos error en este caso
        } 
        // Si hay problemas de permisos
        else if (error.message.includes('permission')) {
          this.errorMessage = 'Se requieren permisos para acceder a la cámara/galería';
        } 
        // Para otros errores
        else {
          this.errorMessage = `Error: ${error.message}`;
        }
      } else {
        this.errorMessage = 'Ocurrió un error desconocido';
      }
    } finally {
      this.loading = false;
    }
  }

  removeImage() {
    this.imagePreview = null;
    this.fileName = '';
    this.errorMessage = '';
  }

  async onSubmit() {
    if (this.reportForm.invalid || this.isSubmitting) return;
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    try {
      const user = this.auth.currentUser;
      const description = this.reportForm.get('description')?.value;
      
      // Crear mensaje para Telegram
      let message = `<b>🐞 REPORTE DE ERROR</b>\n\n`;
      message += `<b>Usuario:</b> ${user?.displayName || 'No disponible'}\n`;
      message += `<b>Email:</b> ${user?.email || 'No disponible'}\n`;
      message += `<b>ID:</b> ${user?.uid || 'No disponible'}\n\n`;
      message += `<b>Descripción:</b>\n${description}`;
      
      // Enviar mensaje a Telegram
      if (this.imagePreview) {
        // Si hay imagen, extraer la base64 (omitiendo el encabezado)
        const base64Data = this.imagePreview.split(',')[1];
        await this.telegramService.sendMessage(message, base64Data);
      } else {
        await this.telegramService.sendMessage(message);
      }

      // Mostrar mensaje de éxito
      await this.showAlert('Reporte enviado', 'Gracias por tu reporte. Lo revisaremos lo antes posible.');
      
      // Resetear el formulario
      this.reportForm.reset();
      this.removeImage();
      
      // Navegar de vuelta a configuraciones
      this.navigateBack();
      
    } catch (error) {
      console.error('Error al enviar reporte:', error);
      this.errorMessage = 'No se pudo enviar el reporte. Por favor intenta nuevamente.';
      await this.showAlert('Error', 'No se pudo enviar el reporte. Por favor intenta nuevamente.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
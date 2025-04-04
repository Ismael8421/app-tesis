// profile.component.ts
import { Component, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { RegisterService, userCreate } from '../../../register/data-access/register.service';
import { CommonModule } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { ThemeService } from '../settings/data-access/theme.service';
import { ProfileImageService } from './profile-image.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PreferencesService } from './preferences.service';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  imageOutline,
  closeOutline,
  addOutline,
  removeOutline,
  refreshOutline,
  camera,
  chevronDownOutline,
  create
} from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  ActionSheetController,
  AlertController,
  LoadingController,
  IonAvatar,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRange,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  IonSelect,
  IonInput,
  IonSelectOption
} from '@ionic/angular/standalone';
import { doc, Firestore, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    BackIconComponent,
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButton,
    IonButtons,
    IonTitle,
    IonSpinner,
    IonText,
    IonAvatar,
    IonImg,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonModal,
    IonRange,
    IonSelect,
    IonSelectOption,
    IonInput,
    ReactiveFormsModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private _router = inject(Router);
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);
  private _themeService = inject(ThemeService);
  private _actionSheetCtrl = inject(ActionSheetController);
  private _alertController = inject(AlertController);
  private _profileImageService = inject(ProfileImageService);
  private _zone = inject(NgZone);
  private _preferencesService = inject(PreferencesService);
  private _loadingController = inject(LoadingController);
  private _formBuilder = inject(FormBuilder);
  private _firestore = inject(Firestore);

  isEditProfileModalOpen = false;
  isProcessingForm = false;
  profileForm!: FormGroup;
  hasMencion = false;
  mencionesActuales: Array<{ valor: string, display: string }> = [];

  carreras = [
    { display: 'IEME', value: 'IEME' },
    { display: 'MCM', value: 'MCM' },
    { display: 'EMA', value: 'EMA' },
    { display: 'Mecatrónica', value: 'Mecatronica' },
    { display: 'Informática', value: 'Informatica' },
    { display: 'Ciencias', value: 'Ciencias' }
  ];

  menciones: { [key: string]: Array<{ valor: string, display: string }> } = {
    'Informatica': [
      { valor: 'Programacion movil', display: 'Programación móvil' },
      { valor: 'Aplicaciones web', display: 'Aplicaciones web' }
    ],
    'IEME': [
      { valor: 'Electronica digital', display: 'Electrónica digital' },
      { valor: 'Sistemas electricos de Potencia', display: 'Sistemas eléctricos de Potencia' }
    ],
    'MCM': [
      { valor: 'Diseno y automatizacion de maquinas y mecanismos', display: 'Diseño y automatización de máquinas y mecanismos' },
      { valor: 'Mecanica de precision y produccion de serie', display: 'Mecánica de precisión y producción de serie' }
    ],
    'EMA': [
      { valor: 'Electrotecnia automotriz', display: 'Electrotecnia automotriz' },
      { valor: 'Mantenimiento automotriz', display: 'Mantenimiento automotriz' }
    ],
    'Ciencias': [
      { valor: 'Matematica y Fisica avanzada', display: 'Matemática y Física avanzada' },
      { valor: 'Ciencias de la salud', display: 'Ciencias de la salud' },
      { valor: 'Ciencias de la politica', display: 'Ciencias de la política' }
    ]
  };

  isFullImageModalOpen = false;

  // Variables para el recuadro de recorte
  cropFrameSize = 200; // Tamaño inicial del recuadro en px
  cropFrameX = 0; // Posición X del recuadro
  cropFrameY = 0; // Posición Y del recuadro
  isFrameDragging = false; // Para detectar si se está arrastrando
  lastTouchX = 0; // Última posición X tocada
  lastTouchY = 0; // Última posición Y tocada
  imageContainerRect: DOMRect | null = null; // Dimensiones del contenedor de la imagen

  @ViewChild('cropImage') cropImageElement: ElementRef<HTMLImageElement> | undefined;
  @ViewChild('cropFrame') cropFrameElement: ElementRef<HTMLDivElement> | undefined;

  imageRotation: number = 0; // Para la rotación de la imagen en grados
  frameScalePercent: number = 70; // Porcentaje inicial del tamaño del recuadro (70%)

  imageWidth = 0; // Ancho natural de la imagen
  imageHeight = 0; // Alto natural de la imagen
  cropSize = 300; // Tamaño del cuadro de recorte en píxeles

  userData: userCreate | null = null;
  loading = true;
  error: string | null = null;
  isDarkMode: boolean = false;

  // Imagen de perfil
  profileImagePreview: string | null = null;
  tempImageUrl: string | null = null;

  // Modal para recortar
  isCropModalOpen = false;

  // Variables para manipulación de imagen
  isProcessingImage = false;

  constructor() {
    // Registrar iconos
    addIcons({
      camera,
      'camera-outline': cameraOutline,
      'image-outline': imageOutline,
      'close-outline': closeOutline,
      'add-outline': addOutline,
      'remove-outline': removeOutline,
      'refresh-outline': refreshOutline,
      'chevron-down-outline': chevronDownOutline,
      'create-outline': create // Añadir este icono
    });

    // Suscribirse a los cambios del tema usando takeUntilDestroyed
    this._themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateDarkModeStatus();
      });
  }

  async ngOnInit() {
    // Inicializar el estado del modo oscuro
    this.updateDarkModeStatus();

    try {
      // Obtener el usuario actual
      const currentUser = this._auth.currentUser;
      if (!currentUser) {
        this._router.navigate(['/login']);
        return;
      }

      // Obtener los datos del usuario
      this.userData = await this._registerService.getUserData(currentUser.uid);

      // Cargar la imagen de perfil si existe
      if (currentUser.uid) {
        const savedImage = this._profileImageService.getProfileImage(currentUser.uid);
        if (savedImage) {
          this.profileImagePreview = savedImage;
        }
      }

      // Verificar si el usuario tiene mención
      if (this.userData && 'mencion' in this.userData && this.userData.mencion) {
        this.hasMencion = true;

        // Actualizar las menciones disponibles según la carrera
        if (this.userData.carrera in this.menciones) {
          this.mencionesActuales = this.menciones[this.userData.carrera];
        }
      }

      this.loading = false;
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
      this.error = 'Error al cargar los datos del perfil';
      this.loading = false;
    }
  }

  openFullImageModal() {
    if (this.profileImagePreview) {
      this._zone.run(() => {
        this.isFullImageModalOpen = true;
      });
    }
  }

  closeFullImageModal() {
    this._zone.run(() => {
      this.isFullImageModalOpen = false;
    });
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

  navigateTo() {
    this._router.navigateByUrl('/menu/configuraciones');
  }

  // ---- Funciones para manejar la foto de perfil ----

  async presentPhotoOptions() {
    const actionSheet = await this._actionSheetCtrl.create({
      header: 'Cambiar foto de perfil',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => {
            this.getImage(CameraSource.Camera);
          }
        },
        {
          text: 'Seleccionar de galería',
          icon: 'image-outline',
          handler: () => {
            this.getImage(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ],
      cssClass: this.isDarkMode ? 'action-sheet-dark' : 'action-sheet-light'
    });

    await actionSheet.present();
  }

  async checkCameraPermissions() {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Camera.checkPermissions();
        if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
          await Camera.requestPermissions();
        }
      } catch (error) {
        console.error('Error al verificar permisos:', error);
        this.showAlert('Permisos necesarios', 'Se requieren permisos para acceder a la cámara y galería');
      }
    }
  }

  async getImage(source: CameraSource) {
    try {
      console.log('Iniciando captura de imagen desde:', source === CameraSource.Camera ? 'Cámara' : 'Galería');

      // Verificar permisos primero
      await this.checkCameraPermissions();

      // Configuración de la cámara
      const imageResult = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source,
        correctOrientation: true, // Importante para corregir la orientación
        webUseInput: true, // Para web
        width: 1200, // Limitar ancho para optimizar
        height: 1200, // Limitar alto para optimizar
      });

      if (imageResult && imageResult.dataUrl) {
        console.log('Imagen obtenida correctamente');

        // Asegurarse de que el modal esté cerrado antes de abrir uno nuevo
        this.isCropModalOpen = false;

        // Usar NgZone para asegurar que Angular detecte los cambios
        this._zone.run(() => {
          // Asignar la URL de la imagen
          this.tempImageUrl = imageResult.dataUrl ?? null;

          // Abrir el modal con un pequeño retraso para que Angular actualice la vista
          setTimeout(() => {
            console.log('Abriendo modal de recorte...');
            this.isCropModalOpen = true;

            // Inicializar el recuadro después de abrir el modal
            setTimeout(() => {
              this.initializeCropFrame();
            }, 300);
          }, 300);
        });
      } else {
        console.warn('No se obtuvieron datos de imagen');
      }
    } catch (error) {
      console.error('Error al obtener imagen:', error);

      if (error instanceof Error) {
        // Manejo específico de errores
        if (error.message.includes('User cancelled')) {
          console.log('El usuario canceló la selección');
        } else {
          this.showAlert('Error', `No se pudo obtener la imagen: ${error.message}`);
        }
      }
    }
  }

  // ---- Funciones para el recorte de imagen ----

  cancelCrop() {
    this.isCropModalOpen = false;
    this.tempImageUrl = null;
    this.imageRotation = 0; // Resetear rotación
  }

  // Método para abrir el modal de recorte manualmente (botón de emergencia)
  openCropModal() {
    if (this.tempImageUrl) {
      console.log('Abriendo modal de recorte manualmente');
      this._zone.run(() => {
        this.isCropModalOpen = true;

        // cuando la imagen se cargue gracias al evento (load) en el HTML
      });
    } else {
      this.showAlert('Error', 'No hay imagen para recortar');
    }
  }

  // Corregir el método saveCroppedImage() en profile.component.ts
  async saveCroppedImage() {
    this.isProcessingImage = true;

    try {
      // Verificar usuario
      const currentUser = this._auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        this.showAlert('Error', 'Usuario no identificado');
        return;
      }

      // Obtener referencias a elementos
      const img = this.cropImageElement?.nativeElement;
      const frame = this.cropFrameElement?.nativeElement;

      if (!img || !frame || !this.imageContainerRect) {
        this.showAlert('Error', 'No se pudo encontrar los elementos necesarios');
        return;
      }

      // Dimensiones finales para el canvas
      const finalSize = 300;

      // Paso 1: Crear un canvas con la imagen original
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = img.naturalWidth;
      originalCanvas.height = img.naturalHeight;

      const originalCtx = originalCanvas.getContext('2d');
      if (!originalCtx) {
        throw new Error('No se pudo crear el contexto del canvas original');
      }

      // Dibujar la imagen original
      originalCtx.drawImage(img, 0, 0);

      // Paso 2: Crear un canvas para la rotación
      const rotatedCanvas = document.createElement('canvas');
      let rotatedCtx = rotatedCanvas.getContext('2d');

      if (!rotatedCtx) {
        throw new Error('No se pudo crear el contexto del canvas rotado');
      }

      // Normalizar rotación
      const rotation = ((this.imageRotation % 360) + 360) % 360;

      // Ajustar tamaño del canvas según rotación
      if (rotation === 90 || rotation === 270) {
        rotatedCanvas.width = originalCanvas.height;
        rotatedCanvas.height = originalCanvas.width;
      } else {
        rotatedCanvas.width = originalCanvas.width;
        rotatedCanvas.height = originalCanvas.height;
      }

      // Aplicar rotación
      rotatedCtx.save();
      rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rotatedCtx.rotate((rotation * Math.PI) / 180);

      // Dibujar en el centro
      if (rotation === 90 || rotation === 270) {
        rotatedCtx.drawImage(
          originalCanvas,
          -originalCanvas.height / 2,
          -originalCanvas.width / 2,
          originalCanvas.height,
          originalCanvas.width
        );
      } else {
        rotatedCtx.drawImage(
          originalCanvas,
          -originalCanvas.width / 2,
          -originalCanvas.height / 2,
          originalCanvas.width,
          originalCanvas.height
        );
      }

      rotatedCtx.restore();

      // Paso 3: Calcular la región de recorte
      // Obtener las dimensiones de la imagen mostrada en pantalla
      const imgRect = img.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();

      // Calcular el centro de la imagen en el DOM
      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;

      // Calcular el centro del marco de recorte en el DOM
      const frameCenterX = frameRect.left + frameRect.width / 2;
      const frameCenterY = frameRect.top + frameRect.height / 2;

      // Calcular el desplazamiento relativo (de -1 a 1) del marco desde el centro de la imagen
      let relOffsetX = (frameCenterX - imgCenterX) / (imgRect.width / 2);
      let relOffsetY = (frameCenterY - imgCenterY) / (imgRect.height / 2);

      // Ajustar el desplazamiento basado en la rotación
      if (rotation === 90) {
        const temp = relOffsetX;
        relOffsetX = -relOffsetY;
        relOffsetY = temp;
      } else if (rotation === 180) {
        relOffsetX = -relOffsetX;
        relOffsetY = -relOffsetY;
      } else if (rotation === 270) {
        const temp = relOffsetX;
        relOffsetX = relOffsetY;
        relOffsetY = -temp;
      }

      // Calcular el tamaño relativo del marco comparado con la imagen
      const imgMinDim = Math.min(imgRect.width, imgRect.height);
      const frameRelSize = frameRect.width / imgMinDim;

      // Calcular la región de recorte en el canvas rotado
      const rotatedMinDim = Math.min(rotatedCanvas.width, rotatedCanvas.height);
      const cropSize = rotatedMinDim * frameRelSize;

      // Calcular las coordenadas centrales del área de recorte
      const cropCenterX = rotatedCanvas.width / 2 + relOffsetX * (rotatedCanvas.width / 2);
      const cropCenterY = rotatedCanvas.height / 2 + relOffsetY * (rotatedCanvas.height / 2);

      // Calcular las coordenadas superiores izquierdas del área de recorte
      const cropX = cropCenterX - (cropSize / 2);
      const cropY = cropCenterY - (cropSize / 2);

      // Paso 4: Crear canvas final y recortar
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalSize;
      finalCanvas.height = finalSize;

      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) {
        throw new Error('No se pudo crear el contexto del canvas final');
      }

      // Dibujar la región recortada en el canvas final
      finalCtx.drawImage(
        rotatedCanvas,
        cropX, cropY, cropSize, cropSize,
        0, 0, finalSize, finalSize
      );

      // Obtener la imagen resultante como dataURL
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.9);

      // Guardar la imagen
      this._profileImageService.saveProfileImage(currentUser.uid, dataUrl);

      // Actualizar la vista
      this.profileImagePreview = dataUrl;
      this.isCropModalOpen = false;
      this.tempImageUrl = null;
      this.imageRotation = 0; // Resetear rotación

      // Mostrar mensaje de éxito
      this.showSuccessToast('Foto de perfil actualizada');

    } catch (error) {
      console.error('Error al recortar la imagen:', error);
      this.showAlert('Error', 'No se pudo guardar la imagen');
    } finally {
      this.isProcessingImage = false;
    }
  }

  // Debug para el estado del modal
  logModalState() {
    console.log('Estado del modal:', {
      isCropModalOpen: this.isCropModalOpen,
      tempImageUrl: this.tempImageUrl ? 'Disponible' : 'No disponible',
      profileImagePreview: this.profileImagePreview ? 'Disponible' : 'No disponible'
    });
  }

  // Alerta para errores
  async showAlert(header: string, message: string) {
    const alert = await this._alertController.create({
      header,
      message,
      buttons: ['OK'],
      cssClass: this.isDarkMode ? 'dark-alert' : 'light-alert'
    });
    await alert.present();
  }

  handleImageLoad() {
    console.log('Imagen cargada correctamente');

    // En la próxima actualización del ciclo de vida de Angular
    setTimeout(() => {
      this.initializeCropFrame();
    }, 100);
  }

  onZoomChange(event: any) {
    if (!this.imageContainerRect) return;

    // Obtener el valor del slider (entre 1 y 3)
    const zoomValue = event.detail.value;

    // Calcular el nuevo tamaño como porcentaje de la imagen
    // El tamaño más pequeño es 30% de la imagen, el más grande es 90%
    const minSide = Math.min(this.imageContainerRect.width, this.imageContainerRect.height);
    const minSize = minSide * 0.3;
    const maxSize = minSide * 0.9;

    // Interpolar entre min y max basado en el valor del zoom
    // zoomValue=1 → cropFrameSize=maxSize (zoom mínimo = recuadro grande)
    // zoomValue=3 → cropFrameSize=minSize (zoom máximo = recuadro pequeño)
    const range = maxSize - minSize;
    const reversedZoom = 4 - zoomValue; // Invertimos para que el comportamiento sea intuitivo
    this.cropFrameSize = minSize + ((reversedZoom - 1) / 2) * range;

    // Restringir la posición después de cambiar el tamaño
    this.constrainFramePosition();
  }

  async showSuccessToast(message: string) {
    const alertElement = document.createElement('div');
    alertElement.textContent = message;
    alertElement.className = `success-toast ${this.isDarkMode ? 'dark-toast' : 'light-toast'}`;
    document.body.appendChild(alertElement);

    setTimeout(() => {
      alertElement.classList.add('show');

      setTimeout(() => {
        alertElement.classList.remove('show');
        setTimeout(() => document.body.removeChild(alertElement), 300);
      }, 2000);
    }, 100);
  }

  ngAfterViewInit() {
    // Inicializar después de que la vista esté lista
    setTimeout(() => {
      this.initializeCropFrame();
    }, 500);

    // Agregar listeners globales para manejar el movimiento
    // fuera del elemento cuando se arrastra
    document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    document.addEventListener('touchmove', this.handleGlobalTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleGlobalTouchEnd.bind(this));
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    document.removeEventListener('touchmove', this.handleGlobalTouchMove.bind(this));
    document.removeEventListener('touchend', this.handleGlobalTouchEnd.bind(this));
  }

  handleGlobalMouseMove(event: MouseEvent) {
    this.onFrameMouseMove(event);
  }

  handleGlobalMouseUp() {
    this.onFrameMouseUp();
  }

  handleGlobalTouchMove(event: TouchEvent) {
    if (this.isFrameDragging) {
      this.onFrameTouchMove(event);
    }
  }

  handleGlobalTouchEnd() {
    this.onFrameTouchEnd();
  }

  initializeCropFrame() {
    const imgElement = this.cropImageElement?.nativeElement;
    if (!imgElement || !imgElement.complete) {
      imgElement?.addEventListener('load', () => this.initializeCropFrame());
      return;
    }

    // Obtener el rectángulo del contenedor de la imagen
    const imgRect = imgElement.getBoundingClientRect();
    this.imageContainerRect = imgRect;

    // Inicializar el tamaño del recuadro al porcentaje configurado
    const minSide = Math.min(imgRect.width, imgRect.height);
    this.cropFrameSize = minSide * (this.frameScalePercent / 100);

    // Centrar el recuadro en la imagen
    this.cropFrameX = 0;
    this.cropFrameY = 0;

    console.log('Recuadro inicializado:', {
      imageRect: imgRect,
      cropFrameSize: this.cropFrameSize,
      cropFramePosition: { x: this.cropFrameX, y: this.cropFrameY }
    });
  }

  onFrameTouchStart(event: TouchEvent) {
    if (event.touches.length === 1) {
      this.isFrameDragging = true;
      this.lastTouchX = event.touches[0].clientX;
      this.lastTouchY = event.touches[0].clientY;
      event.preventDefault(); // Importante para evitar scroll
    }
  }

  onFrameTouchMove(event: TouchEvent) {
    if (!this.isFrameDragging || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - this.lastTouchX;
    const deltaY = event.touches[0].clientY - this.lastTouchY;

    this.moveFrame(deltaX, deltaY);

    this.lastTouchX = event.touches[0].clientX;
    this.lastTouchY = event.touches[0].clientY;
    event.preventDefault();
  }

  onFrameTouchEnd() {
    this.isFrameDragging = false;
  }

  onFrameMouseDown(event: MouseEvent) {
    this.isFrameDragging = true;
    this.lastTouchX = event.clientX;
    this.lastTouchY = event.clientY;
    event.preventDefault();
  }

  onFrameMouseMove(event: MouseEvent) {
    if (!this.isFrameDragging) return;

    const deltaX = event.clientX - this.lastTouchX;
    const deltaY = event.clientY - this.lastTouchY;

    this.moveFrame(deltaX, deltaY);

    this.lastTouchX = event.clientX;
    this.lastTouchY = event.clientY;

    // Prevenir comportamiento predeterminado
    event.preventDefault();
  }


  onFrameMouseUp() {
    this.isFrameDragging = false;
  }

  // Mover el recuadro con restricciones
  moveFrame(deltaX: number, deltaY: number) {
    this.cropFrameX += deltaX;
    this.cropFrameY += deltaY;

    // Restringir posición
    this.constrainFramePosition();
  }

  // Restringir la posición del recuadro dentro de los límites de la imagen
  constrainFramePosition() {
    if (!this.imageContainerRect) return;

    const halfFrameSize = this.cropFrameSize / 2;

    // Calcular los límites basados en el centro de la imagen
    const imageWidth = this.imageContainerRect.width;
    const imageHeight = this.imageContainerRect.height;

    // Calcular márgenes máximos desde el centro
    const maxX = (imageWidth / 2) - halfFrameSize;
    const maxY = (imageHeight / 2) - halfFrameSize;

    // Aplicar restricciones
    this.cropFrameX = Math.max(-maxX, Math.min(maxX, this.cropFrameX));
    this.cropFrameY = Math.max(-maxY, Math.min(maxY, this.cropFrameY));
  }

  rotateImage(degrees: number) {
    this.imageRotation = (this.imageRotation + degrees) % 360;

    // Después de rotar, es necesario recalcular los límites
    setTimeout(() => {
      // Re-obtener el rectángulo de la imagen después de la rotación
      const imgElement = this.cropImageElement?.nativeElement;
      if (imgElement) {
        this.imageContainerRect = imgElement.getBoundingClientRect();

        // Asegurarse de que el recuadro esté dentro de los límites después de rotar
        this.constrainFramePosition();
      }
    }, 350); // Esperar a que termine la transición de rotación
  }

  onFrameSizeChange(event: any) {
    // Obtener el valor del slider (entre 30 y 90)
    this.frameScalePercent = event.detail.value;

    if (!this.imageContainerRect) return;

    // Calcular el nuevo tamaño como porcentaje de la imagen
    const minSide = Math.min(this.imageContainerRect.width, this.imageContainerRect.height);
    this.cropFrameSize = minSide * (this.frameScalePercent / 100);

    // Restringir la posición después de cambiar el tamaño
    this.constrainFramePosition();
  }

  async resetPreferencesForm() {
    const currentUser = this._auth.currentUser;
    if (!currentUser) {
      this.showAlert('Error', 'Usuario no identificado');
      return;
    }

    // Mostrar alerta de confirmación
    const alert = await this._alertController.create({
      header: 'Reiniciar preferencias',
      message: '¿Estás seguro de que quieres reiniciar tus preferencias? Tendrás que completar el formulario nuevamente para recibir recomendaciones personalizadas.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Sí, reiniciar',
          handler: async () => {
            try {
              // Usar LoadingController en lugar de AlertController para el spinner
              const loading = await this._loadingController.create({
                message: 'Restableciendo preferencias...',
                spinner: 'crescent'
              });
              await loading.present();

              // Actualizar el valor en Firebase
              await this._preferencesService.resetPreferencesForm(currentUser.uid);

              // Cerrar loading spinner
              await loading.dismiss();

              // Mostrar mensaje de éxito
              const successAlert = await this._alertController.create({
                header: 'Preferencias reiniciadas',
                message: 'Ahora puedes completar el formulario de preferencias nuevamente. Dirígete a la sección "Descubrir" para hacerlo.',
                buttons: ['OK']
              });
              await successAlert.present();
            } catch (error) {
              console.error('Error al restablecer preferencias:', error);
              this.showAlert('Error', 'No se pudieron restablecer las preferencias. Inténtalo más tarde.');
            }
          }
        }
      ],
      cssClass: this.isDarkMode ? 'dark-alert' : 'light-alert'
    });

    await alert.present();
  }

  // Inicializa el formulario con los datos actuales del usuario
  initProfileForm() {
    if (!this.userData) return;

    // Crear configuración base del formulario
    const formConfig: any = {
      nombreUsuario: [this.userData.nombreUsuario, Validators.required],
      nombre: [this.userData.nombre, Validators.required],
      apellido: [this.userData.apellido, Validators.required],
      anioLectivo: [this.userData.anioLectivo, Validators.required],
      paralelo: [this.userData.paralelo, Validators.required],
      carrera: [this.userData.carrera, Validators.required]
    };

    // Determinar si debe mostrar mención inicialmente
    this.hasMencion = this.userData.anioLectivo === 'Tercero' &&
      this.menciones[this.userData.carrera] !== undefined;

    // Añadir mención solo si debe mostrarse y el usuario ya tiene una
    if (this.hasMencion && this.userData.mencion) {
      formConfig.mencion = [this.userData.mencion];
      this.mencionesActuales = this.menciones[this.userData.carrera] || [];
    } else {
      formConfig.mencion = [''];
    }

    // Crear el formulario
    this.profileForm = this._formBuilder.group(formConfig);

    // Verificar cambios en carrera y año lectivo para actualizar la visibilidad de mención
    this.profileForm.get('carrera')?.valueChanges.subscribe(this.checkMencionVisibility.bind(this));
    this.profileForm.get('anioLectivo')?.valueChanges.subscribe(this.checkMencionVisibility.bind(this));

    // Verificar la visibilidad inicial
    this.checkMencionVisibility();
  }

  // Método para verificar si se debe mostrar la mención
  checkMencionVisibility() {
    const anioLectivo = this.profileForm.get('anioLectivo')?.value;
    const carrera = this.profileForm.get('carrera')?.value;

    // La mención solo se muestra si es de tercero y la carrera tiene menciones disponibles
    this.hasMencion = anioLectivo === 'Tercero' &&
      carrera &&
      this.menciones[carrera] !== undefined;

    // Actualizar menciones disponibles si corresponde
    if (this.hasMencion && carrera) {
      this.mencionesActuales = this.menciones[carrera] || [];

      // Si no hay valor actual de mención, establecer un valor vacío
      if (!this.profileForm.get('mencion')?.value) {
        this.profileForm.get('mencion')?.setValue('');
      }

      // Agregar validación si es necesario
      if (carrera !== 'Mecatronica') {
        this.profileForm.get('mencion')?.setValidators(Validators.required);
      } else {
        this.profileForm.get('mencion')?.clearValidators();
      }
    } else {
      // Si no se debe mostrar la mención, eliminar su valor
      this.profileForm.get('mencion')?.setValue('');
      this.profileForm.get('mencion')?.clearValidators();
    }

    // Actualizar validación
    this.profileForm.get('mencion')?.updateValueAndValidity();
  }

  // Abre el modal de edición
  openEditProfileModal() {
    this.initProfileForm();
    this.isEditProfileModalOpen = true;
  }

  // Cancela la edición
  cancelEditProfile() {
    this.isEditProfileModalOpen = false;
  }

  // Guarda los cambios del perfil
  // Método para guardar los cambios del perfil
  async saveProfile() {
    if (this.profileForm.invalid) {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(this.profileForm.controls).forEach(key => {
        const control = this.profileForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const currentUser = this._auth.currentUser;
    if (!currentUser) {
      this.showAlert('Error', 'Usuario no identificado');
      return;
    }

    this.isProcessingForm = true;

    try {
      // Mostrar indicador de carga
      const loading = await this._loadingController.create({
        message: 'Guardando cambios...',
        spinner: 'crescent'
      });
      await loading.present();

      // Obtener datos del formulario
      const formData = this.profileForm.value;

      // Preparar datos para actualizar
      const dataToUpdate: any = {
        nombreUsuario: formData.nombreUsuario,
        nombre: formData.nombre,
        apellido: formData.apellido,
        anioLectivo: formData.anioLectivo,
        paralelo: formData.paralelo,
        carrera: formData.carrera
      };

      // Verificar si debemos eliminar la mención o actualizarla
      const isThirdYear = formData.anioLectivo === 'Tercero';
      const hasCareerWithMentions = formData.carrera && this.menciones[formData.carrera];

      if (isThirdYear && hasCareerWithMentions && formData.mencion) {
        // Si es de tercero y la carrera tiene menciones, guardamos la mención seleccionada
        dataToUpdate.mencion = formData.mencion;
      } else {
        // Si cambió a segundo año o a una carrera sin menciones, eliminamos el campo
        // Para eliminar un campo en Firestore, hay que establecerlo a null o usar FieldValue.delete()
        // En este caso usamos null para simplificar
        dataToUpdate.mencion = null;
      }

      // Obtener nombre de la colección según la carrera
      const collectionName = this.getCollectionName(formData.carrera);

      // Actualizar en Firestore (primero en la colección específica)
      const userRef = doc(this._firestore, `${collectionName}/${currentUser.uid}`);
      await updateDoc(userRef, dataToUpdate);

      // También actualizar el campo de carrera en la colección general si cambió
      if (this.userData?.carrera !== formData.carrera) {
        const generalUserRef = doc(this._firestore, `usuarios/${currentUser.uid}`);
        await updateDoc(generalUserRef, {
          carrera: formData.carrera
        });
      }

      // Actualizar datos locales
      this.userData = {
        ...this.userData!,
        ...dataToUpdate
      };

      // Si se eliminó la mención, asegurarse de que también se elimine del objeto local
      if (dataToUpdate.mencion === null && this.userData) {
        delete this.userData.mencion;
      }

      // Cerrar indicador de carga
      await loading.dismiss();

      // Mostrar mensaje de éxito
      this.showSuccessToast('Perfil actualizado correctamente');

      // Cerrar modal
      this.isEditProfileModalOpen = false;
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      this.showAlert('Error', 'No se pudo actualizar el perfil. Inténtalo más tarde.');
    } finally {
      this.isProcessingForm = false;
    }
  }

  // Método auxiliar para obtener el nombre de la colección según la carrera
  private getCollectionName(carrera: string): string {
    // Eliminar tildes y espacios para mayor consistencia (igual que en RegisterService)
    return carrera.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
  }
}
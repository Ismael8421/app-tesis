import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { ProfileVisibilityService } from '../../search/data-access/profile-visibility.service';
import { AlertController, Platform } from '@ionic/angular/standalone';
import { BehaviorSubject, Observable } from 'rxjs';

// Importaciones de Capacitor
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';

@Injectable({
  providedIn: 'root'
})
export class UserActivityService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private platform = inject(Platform);
  private alertController = inject(AlertController);
  private profileVisibilityService = inject(ProfileVisibilityService);

  // Constantes para la gestión de recordatorios
  private readonly LAST_ACTIVITY_KEY = 'last_user_activity';
  
  // Para pruebas: 5 minutos y 8 minutos respectivamente
  private readonly REMINDER_DAYS = 15; // 2 minutos expresado en días
  private readonly MAX_INACTIVITY_DAYS = 30; // 4 minutos expresado en días
  
  // Para producción (descomenta estas líneas cuando esté listo)
  // private readonly REMINDER_DAYS = 15; // 15 días
  // private readonly MAX_INACTIVITY_DAYS = 30; // 30 días

  // Estado interno para la UI
  private needsConfirmation$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Escuchar eventos de la app cuando vuelve a primer plano
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.checkInactivity();
      }
    });
  }

  /**
   * Permite obtener si el usuario necesita confirmar su actividad
   */
  public getNeedsConfirmation(): Observable<boolean> {
    return this.needsConfirmation$.asObservable();
  }

  /**
   * Registra la actividad del usuario y actualiza el timestamp
   */
  async registerActivity(activityType: string = 'app_interaction'): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      const now = new Date().toISOString();

      // Guardar en almacenamiento local
      await Preferences.set({
        key: `${this.LAST_ACTIVITY_KEY}_${currentUser.uid}`,
        value: now
      });

      console.log(`Actividad registrada: ${activityType} a las ${now}`);
    } catch (error) {
      console.error('Error al registrar actividad:', error);
    }
  }

  /**
   * Verifica si el usuario ha estado inactivo por demasiado tiempo
   */
  async checkInactivity(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      // Obtener la última fecha de actividad
      const { value } = await Preferences.get({
        key: `${this.LAST_ACTIVITY_KEY}_${currentUser.uid}`
      });

      if (!value) {
        // Si no hay registro, registrar actividad actual
        await this.registerActivity('first_check');
        return;
      }

      const lastActivity = new Date(value);
      const now = new Date();
      const daysSinceLastActivity = this.getDaysDifference(now, lastActivity);

      console.log(`Días desde última actividad: ${daysSinceLastActivity}`);

      // Si ha pasado el tiempo máximo, cambiar a invisible automáticamente
      if (daysSinceLastActivity >= this.MAX_INACTIVITY_DAYS) {
        await this.setInvisible();
      }
      // Si ha pasado el tiempo del recordatorio, mostrar confirmación
      else if (daysSinceLastActivity >= this.REMINDER_DAYS) {
        // Indicar que se necesita confirmación para la UI
        this.needsConfirmation$.next(true);
        
        // Mostrar diálogo en la aplicación
        this.showActivityConfirmationDialog();
      }
    } catch (error) {
      console.error('Error al verificar inactividad:', error);
    }
  }

  /**
   * Establece el perfil del usuario como invisible
   */
  private async setInvisible(): Promise<void> {
    try {
      await this.profileVisibilityService.changeVisibility('invisible');
      console.log('Usuario establecido como invisible por inactividad');

      // Registrar en Firestore que se cambió automáticamente
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        const visibilityRef = doc(this.firestore, 'profileVisibility', currentUser.uid);
        await setDoc(visibilityRef, {
          visibility: 'invisible',
          autoChanged: true,
          autoChangeReason: 'inactivity',
          autoChangeDate: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error al establecer como invisible:', error);
    }
  }

  /**
   * Confirma que el usuario sigue activo
   */
  async confirmActivity(keepVisible: boolean): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      // Registrar la confirmación
      await this.registerActivity('user_confirmation');

      // Si el usuario eligió volverse invisible, cambiar la visibilidad
      if (!keepVisible) {
        await this.profileVisibilityService.changeVisibility('invisible');
      }

      // Restablecer el estado de confirmación
      this.needsConfirmation$.next(false);

      console.log(`Actividad confirmada: mantenerse visible = ${keepVisible}`);
    } catch (error) {
      console.error('Error al confirmar actividad:', error);
    }
  }

  /**
   * Muestra un diálogo de confirmación en la aplicación
   */
  async showActivityConfirmationDialog(): Promise<void> {
    const alert = await this.alertController.create({
      header: '¿Sigues buscando colaboradores?',
      message: 'Han pasado algunos días desde tu última actividad. ¿Deseas seguir apareciendo en las recomendaciones para otros usuarios?',
      buttons: [
        {
          text: 'No, volverme invisible',
          role: 'cancel',
          handler: () => {
            this.confirmActivity(false);
          }
        },
        {
          text: 'Sí, seguir visible',
          handler: () => {
            this.confirmActivity(true);
          }
        }
      ],
      backdropDismiss: false // El usuario debe tomar una decisión
    });

    await alert.present();
  }

  /**
   * Calcula la diferencia en días entre dos fechas
   */
  private getDaysDifference(dateA: Date, dateB: Date): number {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const differenceMs = dateA.getTime() - dateB.getTime();
    return differenceMs / millisecondsPerDay; // Sin Math.floor para detectar fracciones de día
  }

  /**
   * Para pruebas: Fuerza una verificación inmediata
   */
  async forceActivityCheck(): Promise<void> {
    console.log('Estableciendo registro de actividad antiguo...');
    
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('No hay usuario autenticado');
      return Promise.reject('No hay usuario autenticado');
    }
    
    try {
      // Fecha de 6 minutos atrás (tiempo suficiente para mostrar el diálogo)
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 6);
      
      const key = `${this.LAST_ACTIVITY_KEY}_${currentUser.uid}`;
      
      // Guardar fecha antigua
      await Preferences.set({
        key: key,
        value: oldDate.toISOString()
      });
      
      // Verificar que se guardó correctamente
      const { value } = await Preferences.get({ key });
      console.log(`Actividad registrada correctamente: ${value}`);
      
      // Verificar inactividad inmediatamente
      await this.checkInactivity();
      
      console.log('Verificación realizada. Deberías ver el diálogo de confirmación');
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error al forzar verificación:', error);
      return Promise.reject(error);
    }
  }
  
  /**
   * Para pruebas: Muestra el diálogo directamente
   */
  async testDialogDirectly() {
    return this.showActivityConfirmationDialog();
  }
}
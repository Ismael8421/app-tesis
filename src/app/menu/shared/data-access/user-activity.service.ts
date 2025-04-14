import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { ProfileVisibilityService } from '../../search/data-access/profile-visibility.service';
import { AlertController, Platform } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';

// Importaciones de Capacitor
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
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
  private readonly NOTIFICATION_ID = 42; // ID único para nuestras notificaciones
  private readonly ACTIVITY_CHECK_ID = 43; // ID para verificación automática
  private readonly REMINDER_DAYS = 5 / (24 * 60); // 5 minutos expresado en días
  private readonly MAX_INACTIVITY_DAYS = 8 / (24 * 60); // 8 minutos expresado en días

  // Estado interno para la UI
  private needsConfirmation$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Inicializar el sistema de notificaciones cuando la plataforma esté lista
    this.platform.ready().then(() => {
      this.initNotifications();
    });

    // Escuchar eventos de la app cuando vuelve a primer plano
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.checkInactivity();
      }
    });
  }

  /**
   * Inicializa los permisos de notificaciones locales
   */
  private async initNotifications(): Promise<void> {
    try {
      // Verificar si la plataforma soporta notificaciones
      if (this.platform.is('capacitor')) {
        console.log('Inicializando sistema de notificaciones');

        // Crear canal de notificación (importante para Android)
        await LocalNotifications.createChannel({
          id: 'activity-reminders',
          name: 'Recordatorios de actividad',
          description: 'Notificaciones para confirmar actividad en la app',
          importance: 4, // HIGH
          visibility: 1, // PUBLIC
          lights: true,
          vibration: true
        });

        // Solicitar permiso para notificaciones
        const permResult = await LocalNotifications.requestPermissions();
        console.log('Resultado de permisos de notificaciones:', permResult);

        if (permResult.display === 'granted') {
          console.log('Permiso de notificaciones concedido');

          // Registrar listener para cuando se toque una notificación
          LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            console.log('Notificación tocada:', notification);
            this.handleNotificationAction(notification);
          });
        } else {
          console.log('Permiso de notificaciones denegado:', permResult);
        }
      }
    } catch (error) {
      console.error('Error al inicializar notificaciones:', error);
    }
  }

  /**
   * Maneja las acciones cuando se toca una notificación
   */
  private async handleNotificationAction(notificationAction: any): Promise<void> {
    const notificationId = notificationAction.notification.id;

    // Solo procesar nuestras notificaciones específicas
    if (notificationId === this.NOTIFICATION_ID) {
      // Como no tenemos acciones personalizadas, mostrar el diálogo directamente
      this.showActivityConfirmationDialog();
    } else if (notificationId === this.ACTIVITY_CHECK_ID) {
      // Verificación automática de actividad
      this.checkInactivity();
    }
  }

  /**
   * Registra la actividad del usuario y actualiza el timestamp
   */
  async registerActivity(activityType: string = 'app_interaction'): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    try {
      const now = new Date().toISOString();

      // 1. Guardar en almacenamiento local
      await Preferences.set({
        key: `${this.LAST_ACTIVITY_KEY}_${currentUser.uid}`,
        value: now
      });

      // 2. Programar próxima verificación
      this.scheduleActivityCheck();

      console.log(`Actividad registrada: ${activityType} a las ${now}`);
    } catch (error) {
      console.error('Error al registrar actividad:', error);
    }
  }

  /**
   * Programar una verificación futura de actividad
   */
  // Versión temporal para pruebas
  private async scheduleActivityCheck(): Promise<void> {
    try {
      if (!this.platform.is('capacitor')) {
        console.log('No es plataforma capacitor, omitiendo programación');
        return;
      }

      // Verificar que tenemos permisos
      const permResult = await LocalNotifications.requestPermissions();
      if (permResult.display !== 'granted') {
        console.log('No hay permiso para notificaciones, no se pueden programar recordatorios');
        return;
      }

      // PRUEBA: Añadir notificación inmediata para confirmar que funcionan
      const now = new Date();
      now.setSeconds(now.getSeconds() + 30);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999, // ID único para prueba
            title: '[PRUEBA INMEDIATA] Verificando notificaciones',
            body: 'Esta notificación debería aparecer en 30 segundos',
            schedule: { at: now },
            channelId: 'activity-reminders',
            smallIcon: 'ic_notification',
            iconColor: '#4CAF50'
          }
        ]
      });

      console.log('Notificación de prueba inmediata programada para 30 segundos');

      // Calcular fecha para recordatorio
      const reminderDate = new Date();
      reminderDate.setMinutes(reminderDate.getMinutes() + 1); // 1 minuto para prueba

      // Calcular fecha para verificación automática
      const maxInactivityDate = new Date();
      maxInactivityDate.setMinutes(maxInactivityDate.getMinutes() + 2); // 2 minutos para prueba

      // Cancelar notificaciones previas con el mismo ID
      await LocalNotifications.cancel({
        notifications: [
          { id: this.NOTIFICATION_ID },
          { id: this.ACTIVITY_CHECK_ID }
        ]
      });

      console.log(`Programando recordatorio para: ${reminderDate.toISOString()}`);

      // Programar nueva notificación de recordatorio (la principal)
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.NOTIFICATION_ID,
            title: '[PRUEBA INACTIVIDAD] ¿Sigues buscando colaboradores?',
            body: 'Notificación de prueba de inactividad (1 minuto)',
            schedule: { at: reminderDate },
            channelId: 'activity-reminders',
            smallIcon: 'ic_notification',
            iconColor: '#4CAF50',
            extra: {
              type: 'activity_reminder'
            }
          }
        ]
      });

      console.log(`Programando verificación automática para: ${maxInactivityDate.toISOString()}`);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.ACTIVITY_CHECK_ID,
            title: '[PRUEBA INACTIVIDAD] Verificación automática',
            body: 'Prueba de verificación automática (2 minutos)',
            schedule: { at: maxInactivityDate },
            channelId: 'activity-reminders',
            smallIcon: 'ic_notification',
            iconColor: '#4CAF50',
            extra: {
              type: 'activity_check'
            }
          }
        ]
      });

      console.log('Todas las notificaciones programadas correctamente');
    } catch (error) {
      console.error('Error al programar verificación:', error);
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
        if (this.platform.is('capacitor')) {
          this.showActivityConfirmationDialog();
        }
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
  // Modifica este método temporalmente
  async forceActivityCheck(): Promise<void> {
    console.log('Estableciendo registro de actividad antiguo...');

    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      console.error('No hay usuario autenticado');
      return Promise.reject('No hay usuario autenticado');
    }

    try {
      // Fecha de 4 minutos atrás (justo antes del primer recordatorio)
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 4);

      const key = `${this.LAST_ACTIVITY_KEY}_${currentUser.uid}`;

      // Guardar fecha antigua
      await Preferences.set({
        key: key,
        value: oldDate.toISOString()
      });

      // Verificar que se guardó correctamente
      const { value } = await Preferences.get({ key });
      console.log(`Actividad registrada correctamente: ${value}`);

      // Programar verificación inmediatamente
      this.scheduleActivityCheck();

      console.log('Verificación programada. Cierra la app y espera aproximadamente 1-2 minutos');

      return Promise.resolve();
    } catch (error) {
      console.error('Error al forzar verificación:', error);
      return Promise.reject(error);
    }
  }

  // Para pruebas: configura tiempos rápidos (minutos en lugar de días)
  // Para pruebas: configura tiempos rápidos (segundos en lugar de días)
  async setDebugTimers(secondsForReminder: number = 30): Promise<void> {
    try {
      // Verificar usuario actual
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.error('No hay usuario autenticado para configurar debug');
        return Promise.reject('Usuario no autenticado');
      }

      console.log('Activando modo debug para notificaciones...');

      // Programar notificación de recordatorio en X segundos
      const reminderDate = new Date();
      reminderDate.setSeconds(reminderDate.getSeconds() + secondsForReminder);

      // Cancelar notificaciones existentes
      await LocalNotifications.cancel({
        notifications: [
          { id: this.NOTIFICATION_ID },
          { id: this.ACTIVITY_CHECK_ID }
        ]
      });

      console.log(`Programando notificación de prueba para: ${reminderDate.toISOString()}`);

      // Crear canal de notificación (importante para Android)
      await LocalNotifications.createChannel({
        id: 'activity-reminders',
        name: 'Recordatorios de actividad',
        description: 'Notificaciones para confirmar actividad en la app',
        importance: 4, // HIGH
        visibility: 1, // PUBLIC
        lights: true,
        vibration: true
      });

      // Programar nueva notificación de prueba
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.NOTIFICATION_ID,
            title: '[DEBUG] ¿Sigues buscando colaboradores?',
            body: `Notificación de prueba programada para ${secondsForReminder} segundos.`,
            schedule: { at: reminderDate },
            channelId: 'activity-reminders',
            smallIcon: 'ic_notification',
            iconColor: '#4CAF50',
            extra: {
              type: 'debug_test'
            }
          }
        ]
      });

      console.log('Notificación de prueba programada correctamente');

      // También programar verificación automática un poco después
      const maxInactivityDate = new Date();
      maxInactivityDate.setSeconds(maxInactivityDate.getSeconds() + secondsForReminder + 30);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.ACTIVITY_CHECK_ID,
            title: '[DEBUG] Verificación automática',
            body: 'Prueba de verificación automática',
            schedule: { at: maxInactivityDate },
            channelId: 'activity-reminders',
            smallIcon: 'ic_notification',
            iconColor: '#4CAF50',
            extra: {
              type: 'debug_check'
            }
          }
        ]
      });

      console.log('Modo debug activado correctamente.');
      return Promise.resolve();
    } catch (error) {
      console.error('Error al configurar notificaciones de debug:', error);
      return Promise.reject(error);
    }
  }

  // Método para pruebas 
async testInactivityDirectly() {
  const currentUser = this.auth.currentUser;
  if (!currentUser) {
    console.error('No hay usuario autenticado');
    return Promise.reject('No hay usuario autenticado');
  }
  
  try {
    // 1. Programar notificación de prueba inmediata
    const now = new Date();
    now.setSeconds(now.getSeconds() + 15);
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1000, // ID único para esta prueba
          title: 'Verificación de prueba directa',
          body: 'Probando notificaciones directamente',
          schedule: { at: now },
          channelId: 'activity-reminders'
        }
      ]
    });
    
    console.log('Notificación de prueba directa programada');
    
    // 2. Verificar el diálogo directamente
    setTimeout(() => {
      console.log('Mostrando diálogo de confirmación directamente');
      this.showActivityConfirmationDialog();
    }, 5000); // 5 segundos después
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error en prueba directa:', error);
    return Promise.reject(error);
  }
}
}
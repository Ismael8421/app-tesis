import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly NOTIFICATION_INTERVAL = 36 * 36 * 1000000; // 15 dias en milisegundos
  private notificationTimer: any;

  constructor() {
    // Request notification permission for Android 13+
    if (Capacitor.getPlatform() !== 'web') {
      this.requestNotificationPermission();
    }
  }

  // Request permission for notifications on Android
  private async requestNotificationPermission(): Promise<void> {
    await LocalNotifications.requestPermissions();
  }

  // Start sending periodic notifications
  async startPeriodicNotifications(): Promise<void> {
    if (this.notificationTimer) return; // Prevent multiple timers

    if (Capacitor.getPlatform() === 'web') {
      // Web: Use browser Notification API (existing behavior)
      this.notificationTimer = setInterval(() => {
        this.showWebNotification();
      }, this.NOTIFICATION_INTERVAL);
    } else {
      // Native (Android): Schedule repeating local notification
      await this.scheduleLocalNotification();
    }
  }

  // Show browser notification for web
  private showWebNotification(): void {
    if (Notification.permission === 'granted') {
      new Notification('¡Encuentra tu equipo ideal!', {
        body: '¡Hay nuevos usuarios que podrían coincidir con lo que buscas para tu tesis!',
        icon: 'icons/tesis3.0.png'
      });
    }
  }

  // Schedule local notification for Android
  private async scheduleLocalNotification(): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: '¡Encuentra tu equipo ideal!',
          body: '¡Hay nuevos usuarios que podrían coincidir con lo que buscas para tu tesis!',
          id: 1, // Unique ID for the notification
          schedule: {
            every: 'minute', // Capacitor doesn't support arbitrary intervals, use a cron job or server for 15 days
            count: 5 // Repeat every minute for 5 minutes (adjust for testing)
          },
          smallIcon: 'ic_notification' // Add to android/app/src/main/res/drawable
        }
      ]
    });
  }

  // Stop notifications (for cleanup)
  stopPeriodicNotifications(): void {
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer);
      this.notificationTimer = null;
    }
    if (Capacitor.getPlatform() !== 'web') {
      LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    }
  }
}
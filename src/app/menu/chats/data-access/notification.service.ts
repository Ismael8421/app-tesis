import { Injectable, OnDestroy, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, ref, update } from '@angular/fire/database';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private auth = inject(Auth);
  private db = inject(Database);

  private initialized = new BehaviorSubject<boolean>(true);
  public initialized$ = this.initialized.asObservable();

  private subscriptions: Subscription[] = [];

  constructor() {}

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async clearTokensOnLogout(): Promise<void> {
    if (!this.auth.currentUser) return;

    try {
      const userId = this.auth.currentUser.uid;
      const tokenRef = ref(this.db, `fcmTokens/${userId}/token`);
      await update(tokenRef, { active: false, lastLogout: Date.now() });
      console.log('Token marcado como inactivo para el usuario');
    } catch (error) {
      console.error('Error limpiando token del dispositivo:', error);
    }
  }

  async waitForInitialization(): Promise<void> {
    return new Promise<void>((resolve) => {
      const sub = this.initialized$
        .pipe(
          filter(initialized => initialized),
          take(1)
        )
        .subscribe(() => {
          resolve();
          sub.unsubscribe();
        });
    });
  }

  getNotificationPermissionState(): Observable<boolean> {
    return of(Notification.permission === 'granted');
  }
}
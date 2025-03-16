import { Injectable, OnDestroy } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, ref, set, onDisconnect, serverTimestamp } from '@angular/fire/database';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { App } from '@capacitor/app';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService implements OnDestroy {
  private currentChatId: string | null = null;
  private routerSubscription: Subscription;
  private appStateSubscription: any;

  constructor(
    private auth: Auth,
    private db: Database,
    private router: Router
  ) {
    // Monitorear cambios de ruta para detectar cuando el usuario entra/sale de un chat
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.handleRouteChange(event.url);
    });

    // Monitorear estado de la aplicación
    this.setupAppStateListener();

    // Inicializar el estado cuando se carga el servicio
    this.updateOnlineStatus();
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    // Asegurarse de que el usuario aparezca como offline al cerrar
    this.setUserOffline();
  }

  private async setupAppStateListener() {
    // Detectar cuando la app pasa a segundo plano o vuelve al primer plano
    this.appStateSubscription = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // La app volvió al primer plano
        this.updateOnlineStatus();
      } else {
        // La app pasó a segundo plano
        this.setUserOffline();
      }
    });
  }

  private handleRouteChange(url: string) {
    // Detectar si el usuario está en un chat
    const chatMatch = url.match(/\/menu\/mensajes\/([^\/]+)/);
    if (chatMatch && chatMatch[1]) {
      this.currentChatId = chatMatch[1];
    } else {
      this.currentChatId = null;
    }
    
    // Actualizar el estado en Firebase
    this.updateOnlineStatus();
  }

  private async updateOnlineStatus() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const statusRef = ref(this.db, `userStatus/${user.uid}`);
      const status = {
        status: 'online',
        lastSeen: serverTimestamp(),
        currentChatId: this.currentChatId
      };

      // Establecer el estado como 'online'
      await set(statusRef, status);

      // Configurar automáticamente como 'offline' cuando se desconecte
      await onDisconnect(statusRef).update({
        status: 'offline',
        lastSeen: serverTimestamp(),
        currentChatId: null
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }

  private async setUserOffline() {
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      const statusRef = ref(this.db, `userStatus/${user.uid}`);
      await set(statusRef, {
        status: 'offline',
        lastSeen: serverTimestamp(),
        currentChatId: null
      });
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }

  // Método público para actualizar manualmente el estado
  public async refreshStatus() {
    await this.updateOnlineStatus();
  }
}
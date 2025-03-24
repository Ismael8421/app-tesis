import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, fromEvent, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  // Observable para el estado de la red
  private _isOnline = new BehaviorSubject<boolean>(true);
  isOnline$ = this._isOnline.asObservable();

  constructor(private platform: Platform) {
    this.initNetworkMonitor();
  }

  /**
   * Configura los monitores de red para Capacitor y navegador
   */
  private async initNetworkMonitor() {
    if (this.platform.is('capacitor')) {
      // Para aplicaciones nativas usando Capacitor
      // Verificar el estado inicial de la conexión
      const status = await Network.getStatus();
      this._isOnline.next(status.connected);

      // Escuchar cambios en la conexión
      Network.addListener('networkStatusChange', status => {
        console.log('Estado de red cambiado:', status.connected ? 'online' : 'offline');
        this._isOnline.next(status.connected);
      });
    } else {
      // Para entorno de navegador
      // Estado inicial
      this._isOnline.next(navigator.onLine);

      // Crear observables para los eventos online y offline
      const online$ = fromEvent(window, 'online').pipe(map(() => true));
      const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

      // Combinar los observables
      merge(online$, offline$).subscribe(isOnline => {
        console.log('Estado de red cambiado (navegador):', isOnline ? 'online' : 'offline');
        this._isOnline.next(isOnline);
      });
    }
  }

  /**
   * Método conveniente para verificar si hay conexión
   */
  isOnline(): boolean {
    return this._isOnline.value;
  }
}
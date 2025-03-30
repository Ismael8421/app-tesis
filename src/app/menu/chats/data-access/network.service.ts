// Mejora en NetworkService para manejar mejor los cambios de conectividad
import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, fromEvent, merge, Observable } from 'rxjs';
import { map, throttleTime, distinctUntilChanged } from 'rxjs/operators';
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
   * con mejoras en el manejo de eventos
   */
  private async initNetworkMonitor() {
    if (this.platform.is('capacitor')) {
      // Para aplicaciones nativas usando Capacitor
      try {
        // Verificar el estado inicial de la conexión
        const status = await Network.getStatus();
        this._isOnline.next(status.connected);

        // Escuchar cambios en la conexión con un límite de eventos
        Network.addListener('networkStatusChange', status => {
          console.log('Estado de red cambiado:', status.connected ? 'online' : 'offline');
          this._isOnline.next(status.connected);
        });
      } catch (error) {
        console.error('Error inicializando monitor de red nativo:', error);
        // Asumimos que estamos online en caso de error
        this._isOnline.next(true);
      }
    } else {
      // Para entorno de navegador
      // Estado inicial
      this._isOnline.next(navigator.onLine);

      // Crear observables para los eventos online y offline
      // Throttle para evitar múltiples eventos en períodos cortos
      const online$ = fromEvent(window, 'online').pipe(
        throttleTime(1000), 
        map(() => true)
      );
      
      const offline$ = fromEvent(window, 'offline').pipe(
        throttleTime(1000), 
        map(() => false)
      );

      // Combinar los observables y evitar emisiones duplicadas
      merge(online$, offline$)
        .pipe(distinctUntilChanged())
        .subscribe(isOnline => {
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
  
  /**
   * Método para forzar una comprobación de conexión
   * Útil después de una operación fallida que podría indicar pérdida de conectividad
   */
  async checkConnectionNow(): Promise<boolean> {
    if (this.platform.is('capacitor')) {
      try {
        const status = await Network.getStatus();
        this._isOnline.next(status.connected);
        return status.connected;
      } catch (error) {
        console.error('Error verificando estado de red:', error);
        return this._isOnline.value; // devolver el último valor conocido
      }
    } else {
      // En navegador, simplemente usar la API del navegador
      const isOnline = navigator.onLine;
      this._isOnline.next(isOnline);
      return isOnline;
    }
  }
}
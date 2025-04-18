import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private networkStatus = new BehaviorSubject<boolean>(true);

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private async initializeNetworkMonitoring() {
    // Estado inicial
    const status = await Network.getStatus();
    this.networkStatus.next(status.connected);

    // Monitoreo continuo
    Network.addListener('networkStatusChange', (status) => {
      this.networkStatus.next(status.connected);
    });
  }

  getNetworkStatus(): Observable<boolean> {
    return this.networkStatus.asObservable();
  }

  isConnected(): boolean {
    return this.networkStatus.value;
  }
}
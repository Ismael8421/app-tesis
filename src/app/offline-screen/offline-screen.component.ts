import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NetworkService } from '../services/network.service';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-offline-screen',
  standalone: true,
  imports: [IonButton],
  templateUrl: './offline-screen.component.html',
  styleUrls: ['./offline-screen.component.scss']
})
export class OfflineScreenComponent implements OnInit, OnDestroy {
  isOffline = false;
  private networkSubscription: Subscription | undefined;

  constructor(private networkService: NetworkService) { }

  ngOnInit() {
    this.networkSubscription = this.networkService.getNetworkStatus().subscribe(
      isConnected => {
        this.isOffline = !isConnected;
      }
    );
  }

  ngOnDestroy() {
    if (this.networkSubscription) {
      this.networkSubscription.unsubscribe();
    }
  }

  checkConnection() {
    // Simplemente intentar recargar la aplicación
    window.location.reload();
  }
}
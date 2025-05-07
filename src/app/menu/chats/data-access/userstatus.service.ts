// userstatus.service.ts
import { Injectable } from '@angular/core';
import { Database, ref, set, onDisconnect, onValue } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService {
  private statusRef: any;
  private _otherUserStatus = new BehaviorSubject<string>('offline');
  otherUserStatus$ = this._otherUserStatus.asObservable();

  constructor(
    private db: Database,
    private auth: Auth,
    private networkService: NetworkService
  ) {
    this.initStatus();
  }

  private initStatus() {
    this.auth.onAuthStateChanged(user => {
      if (user) {
        // Use the userStatus path from your database structure
        this.statusRef = ref(this.db, `userStatus/${user.uid}`);
        
        // Set online status when connected
        this.networkService.isOnline$.subscribe(isOnline => {
          if (isOnline) {
            this.setOnline();
          } else {
            this.setOffline();
          }
        });

        // Set offline status when the user disconnects
        onDisconnect(this.statusRef).set({
          state: 'offline',
          last_changed: Date.now()
        }).catch(error => {
          console.error('Error setting onDisconnect:', error);
        });

        // Set initial status
        this.refreshStatus();
      }
    });
  }

  setOnline() {
    if (this.statusRef) {
      set(this.statusRef, {
        state: 'online',
        last_changed: Date.now()
      }).catch(error => console.error('Error setting online status:', error));
    }
  }

  setOffline() {
    if (this.statusRef) {
      set(this.statusRef, {
        state: 'offline',
        last_changed: Date.now()
      }).catch(error => console.error('Error setting offline status:', error));
    }
  }

  refreshStatus() {
    this.networkService.checkConnectionNow().then(isOnline => {
      if (isOnline) {
        this.setOnline();
      } else {
        this.setOffline();
      }
    });
  }

  // Monitor another user's status
  monitorUserStatus(userId: string): Observable<string> {
    const userStatusRef = ref(this.db, `userStatus/${userId}`);
    onValue(userStatusRef, (snapshot) => {
      const data = snapshot.val();
      const status = data?.state || 'offline';
      this._otherUserStatus.next(status);
    }, error => {
      console.error('Error monitoring user status:', error);
      this._otherUserStatus.next('offline');
    });
    return this.otherUserStatus$;
  }
}
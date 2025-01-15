import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStateService } from '../../account/shared/data-access/auth-state.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  private _authState = inject(AuthStateService);
    private _router = inject(Router);

    async logOut() {
        await this._authState.logOut();
        this._router.navigateByUrl('/auth/sign-in');
    }
}

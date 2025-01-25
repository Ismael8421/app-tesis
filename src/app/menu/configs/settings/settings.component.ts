import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../../account/shared/data-access/auth-state.service';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, RouterOutlet, IonicModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private _authState = inject(AuthStateService);
  private _router = inject(Router);

  navigateTo() {
    this._router.navigateByUrl('/menu/perfil');
  }

  async logOut() {
    await this._authState.logOut();
    this._router.navigateByUrl('/auth/sign-in');
  }
}

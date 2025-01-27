import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../../account/shared/data-access/auth-state.service';
import { IonicModule } from '@ionic/angular';
import { ThemeService, ThemeType } from './data-access/theme.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, RouterOutlet, IonicModule, CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private _authState = inject(AuthStateService);
  private _router = inject(Router);
  private _themeService = inject(ThemeService);

  currentTheme = this._themeService.getCurrentTheme();
  themeOptions: { value: ThemeType; label: string }[] = [
    { value: 'system', label: 'Igual que el sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' }
  ];

  navigateTo() {
    this._router.navigateByUrl('/menu/perfil');
  }

  navigateToCPE() {
    this._router.navigateByUrl('/menu/chagePwsEmail');
  }

  async logOut() {
    await this._authState.logOut();
    this._router.navigateByUrl('/auth/sign-in');
  }

  onThemeChange(event: any) {
    this._themeService.setTheme(event.detail.value);
  }
}
import { Component, inject, OnInit, HostBinding } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStateService } from '../../../account/shared/data-access/auth-state.service';
import { ThemeService, ThemeType } from './data-access/theme.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonAvatar, 
  IonContent, 
  IonIcon, 
  IonImg, 
  IonItem, 
  IonLabel, 
  IonList, 
  IonSelect, 
  IonSelectOption 
} from '@ionic/angular/standalone';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    RouterLink, 
    RouterOutlet, 
    CommonModule, 
    FormsModule, 
    IonContent, 
    IonList, 
    IonItem, 
    IonAvatar, 
    IonImg, 
    IonLabel, 
    IonIcon, 
    IonSelect, 
    IonSelectOption
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private _authState = inject(AuthStateService);
  private _router = inject(Router);
  private _themeService = inject(ThemeService);

  currentTheme!: ThemeType;
  isDarkMode: boolean = false;
  
  themeOptions: { value: ThemeType; label: string }[] = [
    { value: 'system', label: 'Igual que el sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' }
  ];

  constructor() {
    // Suscribirse a los cambios del tema usando takeUntilDestroyed
    this._themeService.theme$
      .pipe(takeUntilDestroyed())
      .subscribe(theme => {
        this.currentTheme = theme;
        this.updateDarkModeStatus();
      });
  }

  ngOnInit() {
    // Inicializar el tema actual
    this.currentTheme = this._themeService.getCurrentTheme();
    // Determinar si estamos en modo oscuro
    this.updateDarkModeStatus();
  }

  // Actualizar el estado del modo oscuro
  updateDarkModeStatus() {
    this.isDarkMode = this._themeService.isDarkMode();
  }

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

  onThemeChange(event: CustomEvent) {
    const newTheme = event.detail.value as ThemeType;
    this._themeService.setTheme(newTheme);
  }
}
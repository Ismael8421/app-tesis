import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  constructor(private themeService: ThemeService) {
    // Asegurarnos de que el tema se inicialice
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setTheme(savedTheme as 'system' | 'dark' | 'light');
    }
  }
}
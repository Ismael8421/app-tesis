import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeType = 'system' | 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private theme = new BehaviorSubject<ThemeType>('system');
  theme$ = this.theme.asObservable();
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    // Verificar tema guardado al iniciar
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Si no hay tema guardado, usar el del sistema y aplicarlo inmediatamente
      this.setTheme('system');
    }

    // Escuchar cambios en el tema del sistema
    this.mediaQuery.addEventListener('change', (e) => {
      if (this.getCurrentTheme() === 'system') {
        this.applyTheme(e.matches);
      }
    });
  }

  private applyTheme(isDark: boolean) {
    // Aplicar la clase 'dark' al document.body para el modo oscuro
    if (isDark) {
      document.body.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  setTheme(theme: ThemeType) {
    switch (theme) {
      case 'dark':
        this.applyTheme(true);
        break;
      case 'light':
        this.applyTheme(false);
        break;
      case 'system':
        this.applyTheme(this.mediaQuery.matches);
        break;
    }

    localStorage.setItem('theme', theme);
    this.theme.next(theme);
  }

  getCurrentTheme(): ThemeType {
    return this.theme.value;
  }

  isDarkMode(): boolean {
    const currentTheme = this.getCurrentTheme();
    if (currentTheme === 'system') {
      return this.mediaQuery.matches;
    }
    return currentTheme === 'dark';
  }
}
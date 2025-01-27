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
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
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

  // Obtener el estado actual del tema (si está oscuro o no)
  isDarkMode(): boolean {
    const currentTheme = this.getCurrentTheme();
    if (currentTheme === 'system') {
      return this.mediaQuery.matches;
    }
    return currentTheme === 'dark';
  }
}
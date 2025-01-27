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
  private systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    // Recuperar tema guardado
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      this.setTheme('system');
    }
  }

  setTheme(theme: ThemeType) {
    localStorage.setItem('theme', theme);
    
    // Remover el listener anterior si existe
    if (this.systemThemeListener) {
      this.mediaQuery.removeEventListener('change', this.systemThemeListener);
      this.systemThemeListener = null;
    }

    if (theme === 'system') {
      // Aplicar tema basado en preferencia del sistema
      this.applyTheme(this.mediaQuery.matches);
      
      // Crear y agregar nuevo listener
      this.systemThemeListener = (e: MediaQueryListEvent) => {
        this.applyTheme(e.matches);
      };
      this.mediaQuery.addEventListener('change', this.systemThemeListener);
    } else {
      // Aplicar tema específico
      this.applyTheme(theme === 'dark');
    }
    
    this.theme.next(theme);
  }

  private applyTheme(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  getCurrentTheme(): ThemeType {
    return this.theme.value;
  }

  ngOnDestroy() {
    // Limpiar listener cuando el servicio se destruye
    if (this.systemThemeListener) {
      this.mediaQuery.removeEventListener('change', this.systemThemeListener);
    }
  }
}
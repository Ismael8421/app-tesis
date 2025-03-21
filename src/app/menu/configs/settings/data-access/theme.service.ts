import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeType = 'system' | 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private theme = new BehaviorSubject<ThemeType>('system');
  theme$ = this.theme.asObservable();
  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private renderer: Renderer2;

  constructor(rendererFactory: RendererFactory2) {
    // Inicializar el renderer (necesario para manipulación DOM segura)
    this.renderer = rendererFactory.createRenderer(null, null);
    
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
    // 1. Eliminar todas las clases de tema
    document.body.classList.remove('dark-theme', 'light-theme');
    
    // 2. Aplicar la clase correspondiente
    if (isDark) {
      // Modo oscuro
      this.renderer.addClass(document.body, 'dark-theme');
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'dark');
      
      // Eliminar atributos que puedan causar conflicto
      document.body.removeAttribute('class-light');
      document.body.setAttribute('class-dark', 'true');
    } else {
      // Modo claro - aplicamos explícitamente light-theme
      this.renderer.addClass(document.body, 'light-theme');
      this.renderer.setAttribute(document.documentElement, 'data-theme', 'light');
      
      // Eliminar atributos que puedan causar conflicto
      document.body.removeAttribute('class-dark');
      document.body.setAttribute('class-light', 'true');
    }
    
    // 3. Forzar repintado (puede ayudar en ciertos casos)
    document.body.style.transition = 'background-color 0.3s ease';
    
    // 4. Aplicar clase ionic específica (puede ser necesario para ciertos componentes)
    const ionApp = document.querySelector('ion-app');
    if (ionApp) {
      if (isDark) {
        this.renderer.addClass(ionApp, 'dark-theme');
        this.renderer.removeClass(ionApp, 'light-theme');
      } else {
        this.renderer.addClass(ionApp, 'light-theme');
        this.renderer.removeClass(ionApp, 'dark-theme');
      }
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
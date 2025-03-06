import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthStateService } from './account/shared/data-access/auth-state.service';
import { ThemeService } from './menu/configs/settings/data-access/theme.service';
import { NotificationService } from './menu/chats/data-access/notification.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  constructor(
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private auth: Auth
  ) {
    // Asegurarnos de que el tema se inicialice
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.themeService.setTheme(savedTheme as 'system' | 'dark' | 'light');
    }
  }

  ngOnInit() {
    // Inicializar notificaciones push cuando el usuario inicia sesión
    this.auth.onAuthStateChanged(user => {
      if (user) {
        this.notificationService.initPushNotifications();
        this.notificationService.subscribeToChats();
      }
    });
  }
}

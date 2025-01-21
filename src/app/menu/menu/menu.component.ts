import { Component } from '@angular/core';
import { MessagesIconComponent } from '../UI/messages-icon/messages-icon.component';
import { SettingsIconComponent } from '../UI/settings-icon/settings-icon.component';
import { RecomendatioIconComponent } from '../UI/recomendatio-icon/recomendatio-icon.component';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MessagesIconComponent, SettingsIconComponent, RecomendatioIconComponent, RouterOutlet, RouterLink],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {
  
}
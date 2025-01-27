import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [BackIconComponent, IonicModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private _router = inject(Router);

  navigateTo() {
    this._router.navigateByUrl('/menu/configuraciones');
  }
}

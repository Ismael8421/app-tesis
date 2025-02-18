import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackIconComponent } from '../../../UI/back-icon/back-icon.component';
import { RegisterService, userCreate } from '../../../register/data-access/register.service';
import { CommonModule } from '@angular/common';
import { Auth, user } from '@angular/fire/auth';
import { IonAvatar, IonButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonImg, IonItem, IonLabel, IonList, IonNote, IonSpinner, IonText, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [BackIconComponent, CommonModule, IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonTitle, IonSpinner, IonText, IonAvatar, IonImg, IonCard, IonCardContent, IonList, IonItem, IonLabel, IonNote ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private _router = inject(Router);
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);

  userData: userCreate | null = null;
  loading = true;
  error: string | null = null;

  async ngOnInit() {
    try {
      // Obtener el usuario actual
      const currentUser = this._auth.currentUser;
      if (!currentUser) {
        this._router.navigate(['/login']);
        return;
      }

      // Obtener los datos del usuario
      this.userData = await this._registerService.getUserData(currentUser.uid);
      this.loading = false;
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
      this.error = 'Error al cargar los datos del perfil';
      this.loading = false;
    }
  }

  navigateTo() {
    this._router.navigateByUrl('/menu/configuraciones');
  }
}
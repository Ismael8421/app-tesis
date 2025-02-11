import { Component, OnInit, inject } from '@angular/core';
import { RegisterService, userCreate } from '../../../../register/data-access/register.service';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-computing',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './computing.component.html',
  styleUrls: ['./computing.component.scss'],
})
export class ComputingComponent  implements OnInit {
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);
  private _router = inject(Router);

  userData: userCreate | null = null;

  constructor() { }

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
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
    }
  }

}

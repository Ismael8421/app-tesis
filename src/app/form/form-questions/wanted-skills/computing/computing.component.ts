import { Component, OnInit, inject } from '@angular/core';
import { RegisterService, userCreate } from '../../../../register/data-access/register.service';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, ControlContainer, FormGroupDirective } from '@angular/forms';

@Component({
  selector: 'app-computing',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule ],
  templateUrl: './computing.component.html',
  styleUrls: ['./computing.component.scss'],
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupDirective
    }
  ]
})
export class ComputingComponent implements OnInit {
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);
  private _router = inject(Router);

  userData: userCreate | null = null;

  constructor() { }

  async ngOnInit() {
    // try {
    //   const currentUser = this._auth.currentUser;
    //   if (!currentUser) {
    //     this._router.navigate(['/login']);
    //     return;
    //   }

    //   this.userData = await this._registerService.getUserData(currentUser.uid);
    // } catch (error) {
    //   console.error('Error al cargar datos del perfil:', error);
    // }
  }
}
import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { Router } from '@angular/router';

import { PersonalDataComponent } from '../personal-data/personal-data.component';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    NgIf, 
    NgSwitch, 
    NgSwitchCase, 
    NgSwitchDefault, 
    FormsModule, 
    PersonalDataComponent, 
    IonicModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private _userCreate = inject(RegisterService);
  private _authService = inject(AuthService);
  private _router = inject(Router);

  loading = signal(false);

  form: FormGroup;
  page: number = 1;

  constructor() {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      course: new FormControl('', Validators.required),
      profession: new FormControl('', Validators.required),
    });
  }

  async submit() {
    if (this.form.invalid) return

    try {
      this.loading.set(true);

      const user = this._authService.currentUser;

      if (!user || !user.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }

      const uid = user.uid;

      const { username, name, lastName, course, profession } = this.form.value;

      const userData: userCreate = {
        nombreUsuario: username || '',
        nombre: name || '',
        apellido: lastName || '',
        anioLectivo: course || '',
        carrera: profession || '',
      };

      await this._userCreate.create(uid, userData);

      // Eliminar despues
      console.log('Usuario registrado con éxito en Firestore.');
      console.log(this.form.value);

      this._router.navigateByUrl('/menu');

    } catch (error) {
      console.error('Error al crear el documento:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
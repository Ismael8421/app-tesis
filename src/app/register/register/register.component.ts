import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';
import { AuthService } from '../../account/auth/data-access/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  private _userCreate = inject(RegisterService);
  private _authService = inject(AuthService);
  
  loading = signal(false);

  form: FormGroup;

  constructor() {
    this.form = new FormGroup({
      nameUserU: new FormControl('', Validators.required),
      nameUser: new FormControl('', Validators.required),
      secNameUser: new FormControl('', Validators.required),
      courseUser: new FormControl('', Validators.required),
      professionUser: new FormControl('', Validators.required)
    });
  }

  async submit() {
    if (this.form.invalid) return;

    try {
      this.loading.set(true);

      const user = this._authService.currentUser; // Obtiene el usuario autenticado

      if (!user || !user.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }

      const uid = user.uid; // Obtiene el UID del usuario autenticado

      const { nameUserU, nameUser, secNameUser, courseUser, professionUser } = this.form.value;

      const userData: userCreate = {
        nombreUsuario: nameUserU || '',
        nombre: nameUser || '',
        apellido: secNameUser || '',
        curso: courseUser || '',
        carrera: professionUser || ''
      };

      // Crear el documento en Firestore
      await this._userCreate.create(uid, userData);
      console.log('Usuario registrado con éxito en Firestore.');
    } catch (error) {
      console.error('Error al crear el documento:', error);
    } finally{
      this.loading.set(false);
    }
  }
}

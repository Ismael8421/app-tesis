import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  private _userCreate = inject(RegisterService);
  form: FormGroup;//nombre del formulario y los valores se crean directo en el constructor

  constructor() {
    this.form = new FormGroup({
      nameUser: new FormControl('', Validators.required),
      secNameUser: new FormControl('', Validators.required),
      courseUser: new FormControl('', Validators.required),
      professionUser: new FormControl('', Validators.required)
    });
  }

  async submit() {
    if (this.form.invalid) return;

    try {
      const { nameUser, secNameUser, courseUser, professionUser } = this.form.value;
      
      const user: userCreate = {
        nombre: nameUser || '',
        apellido: secNameUser || '',
        curso: courseUser || '',
        carrera: professionUser || ''
      };

      await this._userCreate.create(user);
      console.log('Usuario registrado con éxito');
    } catch (error) {
      console.error('Error al crear el usuario:');
    }
  }
}

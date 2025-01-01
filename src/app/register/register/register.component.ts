import { NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  private _userCreate = inject(RegisterService);
  form: FormGroup;
  usrName: FormControl;

  constructor() {
    this.usrName = new FormControl('', Validators.required);

    this.form = new FormGroup({
      nameUser: this.usrName,
    });
  }

  async submit() {
    if (this.form.invalid) return;

    try {
      const { nameUser } = this.form.value;
      const user: userCreate = {
        nombre: nameUser || '',
      };

      await this._userCreate.create(user);
      console.log('Usuario registrado con éxito');
    } catch (error) {
      console.error('Error al crear el usuario:', error);
    }
  }
}

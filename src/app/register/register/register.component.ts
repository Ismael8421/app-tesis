import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { Router } from '@angular/router';

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
  private _router = inject(Router);
  
  loading = signal(false);

  form: FormGroup;
  currentPage: number = 1; // Página actual del formulario

  constructor() {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      course: new FormControl('', Validators.required),
      profession: new FormControl('', Validators.required),
      preference: new FormGroup({
        commitment: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        }), 
        communication: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        }),

        knowledge: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        }),

        creativity: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        }),

        leadership: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        }),

        time: new FormGroup({
          auto: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]), 
          buscado: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
        })
      })

    });
  }

  nextPage() {
    if (this.currentPage < 5) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
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
        curso: course || '',
        carrera: profession || '',
        preferencias: {
          compromiso: {
            auto: this.form.get('preference.commitment.auto')?.value || 0,
            buscado: this.form.get('preference.commitment.buscado')?.value || 0
          },
          comunicacion: {
            auto: this.form.get('preference.communication.auto')?.value || 0,
            buscado: this.form.get('preference.communication.buscado')?.value || 0
          },
          conocimientos_tecnicos: {
            auto: this.form.get('preference.knowledge.auto')?.value || 0,
            buscado: this.form.get('preference.knowledge.buscado')?.value || 0
          },
          creatividad: {
            auto: this.form.get('preference.creativity.auto')?.value || 0,
            buscado: this.form.get('preference.creativity.buscado')?.value || 0
          },
          liderazgo: {
            auto: this.form.get('preference.leadership.auto')?.value || 0,
            buscado: this.form.get('preference.leadership.buscado')?.value || 0
          },
          tiempo: {
            auto: this.form.get('preference.time.auto')?.value || 0,
            buscado: this.form.get('preference.time.buscado')?.value || 0
          }
        }
      };

      await this._userCreate.create(uid, userData);
      console.log('Usuario registrado con éxito en Firestore.');
      this._router.navigateByUrl('/menu');

    } catch (error) {
      console.error('Error al crear el documento:', error);
    } finally {
      this.loading.set(false);
    }
  }

}

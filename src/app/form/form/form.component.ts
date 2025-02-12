import { Component, inject, signal } from '@angular/core';
import { PreferencesComponent } from '../form-questions/preferences/preferences.component';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WantedProfessionComponent } from '../form-questions/wanted-profession/wanted-profession.component';
import { ComputingComponent } from '../form-questions/wanted-skills/computing/computing.component';
import { PersComputingComponent } from '../form-questions/offer-skills/pers-computing/pers-computing.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { Router } from '@angular/router';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { FormService, formCreate } from '../data-access/form.service';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [ 
    CommonModule,
    ReactiveFormsModule,
    PreferencesComponent,
    WantedProfessionComponent,
    ComputingComponent,
    PersComputingComponent
  ],
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent {
  private _registerService = inject(RegisterService);
  private _formService = inject(FormService);
  private _auth = inject(AuthService);
  private _router = inject(Router);

  userData: userCreate | null = null;
  loading = signal(false);

  form: FormGroup;
  page: number = 1;

  nextPage() {
    if (this.page < 7) {
      this.page++;
    }
  }

  prevPage() {
    if (this.page > 1) {
      this.page--;
    }
  }

  constructor() {
    this.form = new FormGroup({
      //Para preferencias
      schedule: new FormGroup({
        Q1O1: new FormControl(),
        Q1O2: new FormControl(),
        Q1O3: new FormControl(),
        Q1O4: new FormControl() 
      }),
      method: new FormControl('', Validators.required),
      hours: new FormControl('', Validators.required),
      //Para
    }); 
  }

  async submit() {
    if (this.form.invalid) return;
  
    this.loading.set(true);
  
    try {
      const currentUser = this._auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }
  
      const formData: formCreate = {
        horario: {
          durante_almuezo: this.form.get('schedule.Q1O1')?.value || false,
          despues_clases: this.form.get('schedule.Q1O2')?.value || false,
          manana_fines: this.form.get('schedule.Q1O3')?.value || false,
          tarde_fines: this.form.get('schedule.Q1O4')?.value || false
        },
        metodo: this.form.get('method')?.value,
        horas: this.form.get('hours')?.value
      };
  
      // Guardar los datos usando el servicio
      await this._formService.saveFormData(currentUser.uid, formData);
      
      this._router.navigateByUrl('/menu/recomendados');
      console.log('Datos guardados exitosamente');
      // Opcional: redirigir o mostrar mensaje de éxito
      // this._router.navigate(['/ruta-siguiente']);
  
    } catch (error) {
      console.error('Error al crear el documento:', error);
    } finally {
      this.loading.set(false);
    }
  }

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

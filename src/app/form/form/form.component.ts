import { Component, NgModule, inject, signal } from '@angular/core';
import { PreferencesComponent } from '../form-questions/preferences/preferences.component';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { WantedProfessionComponent } from '../form-questions/wanted-profession/wanted-profession.component';
import { ComputingComponent } from '../form-questions/wanted-skills/computing/computing.component';
import { PersComputingComponent } from '../form-questions/offer-skills/pers-computing/pers-computing.component';
import { RegisterService, userCreate } from '../../register/data-access/register.service';
import { Router } from '@angular/router';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { FormService, formCreate } from '../data-access/form.service';
import { EMAComponent } from '../form-questions/wanted-skills/ema/ema.component';
import { IEMEComponent } from '../form-questions/wanted-skills/ieme/ieme.component';
import { MCMComponent } from '../form-questions/wanted-skills/mcm/mcm.component';
import { MechatronicsComponent } from '../form-questions/wanted-skills/mechatronics/mechatronics.component';
import { SciencesComponent } from '../form-questions/offer-skills/sciences/sciences.component';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PreferencesComponent,
    WantedProfessionComponent,
    PersComputingComponent,
    ComputingComponent,
    EMAComponent, 
    IEMEComponent,
    MCMComponent,
    MechatronicsComponent
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
      }, this.atLeastOneCheckedValidator()),
      method: new FormControl('', Validators.required),
      hours: new FormControl('', Validators.required),
      //Para la carrera escojida 
      wanted_profession: new FormGroup({
        O2: new FormControl(false),
        O3: new FormControl(false),
        O4: new FormControl(false),
        O5: new FormControl(false),
        O1: new FormControl(false),
        O6: new FormControl(false)
      }, this.atLeastOneCheckedValidator()), 
      wanted_skills_sec: new FormGroup({
        programing: new FormControl(),
        support: new FormControl(),
        web: new FormControl(),
        networks: new FormControl(),
      }),
      wanted_skilss_third: new FormGroup({
        programming1: new FormControl(),
        desing: new FormControl(),
        cad: new FormControl(),
        support1: new FormControl(),
        mobile: new FormControl(),
        web1: new FormControl(),
        networks1: new FormControl(),
      }),
    });
  }

  shouldShowComponent(componentName: string): boolean {
    const professionValues = this.form.get('wanted_profession')?.value;
    
    switch(componentName) {
      case 'ieme':
        return professionValues?.O1 === true; // Circuitos eléctricos
      case 'mcm':
        return professionValues?.O2 === true; // Construcción metálica
      case 'ema':
        return professionValues?.O3 === true; // Mantenimiento automotriz
      case 'mechatronics':
        return professionValues?.O4 === true; // Mecánica y automatización
      case 'computing':
        return professionValues?.O5 === true; // Desarrollo software
      case 'sciences':
        return professionValues?.O6 === true; // Biología y química
      default:
        return false;
    }
  }

  private atLeastOneCheckedValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const selections = Object.values(formGroup.value);
      const hasSelection = selections.some(value => value === true);
      
      return hasSelection ? null : { requireCheckbox: true };
    };
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

      const scheduleValues = this.form.get('schedule')?.value;

      const horarioSeleccionado = [];
      if (scheduleValues.Q1O1) horarioSeleccionado.push('durante_almuerzo');
      if (scheduleValues.Q1O2) horarioSeleccionado.push('despues_clases');
      if (scheduleValues.Q1O3) horarioSeleccionado.push('manana_fines');
      if (scheduleValues.Q1O4) horarioSeleccionado.push('tarde_fines');

      const wanted_professionValues = this.form.get('wanted_profession')?.value;
      const carreraBuscada = [];
      if (wanted_professionValues.O1) carreraBuscada.push('ieme');
      if (wanted_professionValues.O2) carreraBuscada.push('mcm');
      if (wanted_professionValues.O3) carreraBuscada.push('ema');
      if (wanted_professionValues.O4) carreraBuscada.push('mecatronica');
      if (wanted_professionValues.O5) carreraBuscada.push('informatica');
      if (wanted_professionValues.O6) carreraBuscada.push('ciencias');


      const formData: formCreate = {
        horario: horarioSeleccionado,
        metodo: this.form.get('method')?.value,
        horas: this.form.get('hours')?.value,
        carrera_buscada: carreraBuscada,
        habilidad_buscada_seg: {
          programacion: this.form.get('wanted_skills_sec.programing')?.value,
          soporte: this.form.get('wanted_skills_sec.support')?.value,
          web: this.form.get('wanted_skills_sec.web')?.value,
          redes: this.form.get('wanted_skills_sec.networks')?.value,
        },
        habilidad_buscada_ter: {
          programacion: this.form.get('wanted_skilss_third.programming1')?.value,
          diseño: this.form.get('wanted_skilss_third.desing')?.value,
          cad: this.form.get('wanted_skilss_third.cad')?.value,
          soporte: this.form.get('wanted_skilss_third.support1')?.value,
          mobile: this.form.get('wanted_skilss_third.mobile')?.value,
          web: this.form.get('wanted_skilss_third.web1')?.value,
          redes: this.form.get('wanted_skilss_third.networks1')?.value,
        },
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

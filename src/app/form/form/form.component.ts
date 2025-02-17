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
import { FormStateService } from '../data-access/form-state.service';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';

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
    MechatronicsComponent,
    IonicModule
  ],
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent {
  private _registerService = inject(RegisterService);
  private _formService = inject(FormService);
  private _auth = inject(AuthService);
  private _router = inject(Router);
  private _firestore = inject(Firestore);

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

  constructor(private formStateService: FormStateService) {
    this.form = new FormGroup({
      schedule: new FormGroup({
        Q1O1: new FormControl(false),
        Q1O2: new FormControl(false),
        Q1O3: new FormControl(false),
        Q1O4: new FormControl(false)
      }),
      method: new FormControl(''),
      hours: new FormControl(''),
      wanted_profession: new FormGroup({
        O1: new FormControl(false),
        O2: new FormControl(false),
        O3: new FormControl(false),
        O4: new FormControl(false),
        O5: new FormControl(false),
        O6: new FormControl(false)
      }),
      wanted_skills_sec_inf: new FormGroup({
        programing: new FormControl(''),
        support: new FormControl(''),
        web: new FormControl(''),
        networks: new FormControl('')
      }),
      wanted_skills_third_inf: new FormGroup({
        programming1: new FormControl(''),
        desing: new FormControl(''),
        cad: new FormControl(''),
        support1: new FormControl(''),
        mobile: new FormControl(''),
        web1: new FormControl(''),
        networks1: new FormControl('')
      }),
      offer_skills_sec_inf: new FormGroup({
        programing: new FormControl(''),
        support: new FormControl(''),
        web: new FormControl(''),
        networks: new FormControl('')
      }),
      offer_skills_third_inf: new FormGroup({
        programming1: new FormControl(''),
        desing: new FormControl(''),
        cad: new FormControl(''),
        support1: new FormControl(''),
        mobile: new FormControl(''),
        web1: new FormControl(''),
        networks1: new FormControl('')
      })
    });
  }

  shouldShowComponent(componentName: string): boolean {
    const professionValues = this.form.get('wanted_profession')?.value;

    switch (componentName) {
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
      if (!formGroup || !(formGroup instanceof FormGroup)) {
        return null;
      }
      
      const selections = Object.values(formGroup.value);
      const hasSelection = selections.some(value => value === true);
      
      return hasSelection ? null : { requireCheckbox: true };
    };
  }

  async submit() {
    if (this.form.invalid) {
      console.log('Formulario inválido, pero continuaremos para debug');
    }
  
    this.loading.set(true);
  
    try {
      const currentUser = this._auth.currentUser;
      if (!currentUser || !currentUser.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }
  
      const formData: formCreate = {
        horario: this.getSelectedHorario(),
        metodo: this.form.get('method')?.value || '',
        horas: this.form.get('hours')?.value || '',
        carrera_buscada: this.getSelectedCarreras(),
        habilidad_buscada_seg: {
          informatica_seg: this.form.get('wanted_skills_sec_inf')?.value || {}
        },
        habilidad_buscada_ter: {
          informatica_ter: this.form.get('wanted_skills_third_inf')?.value || {}
        },
        habilidad_ofrecida_seg: {
          informatica_seg_of: this.form.get('offer_skills_sec_inf')?.value || {}
        },
        habilidad_ofrecida_ter: {
          informatica_ter_of: this.form.get('offer_skills_third_inf')?.value || {}
        }
      };
      
      // Intentar crear/actualizar el documento en la colección específica primero
      const generalUserDoc = doc(this._firestore, 'usuarios', currentUser.uid);
      const userSnap = await getDoc(generalUserDoc);
      
      if (!userSnap.exists()) {
        throw new Error('Usuario no encontrado');
      }
      
      const { carrera } = userSnap.data();
      const collectionName = carrera.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");
      
      console.log('Guardando en colección:', collectionName);
      
      // Guardar en la colección específica
      const carreraDoc = doc(this._firestore, collectionName, currentUser.uid);
      await setDoc(carreraDoc, formData, { merge: true });
      
      // Actualizar el estado de completitud
      await updateDoc(generalUserDoc, {
        formCompleted: true
      });
  
      console.log('Datos guardados exitosamente');
      this._router.navigateByUrl('/menu/recomendados');
  
    } catch (error) {
      console.error('Error en submit:', error);
    } finally {
      this.loading.set(false);
    }
  }
  
  private getSelectedHorario(): string[] {
    const schedule = this.form.get('schedule')?.value;
    const horario: string[] = [];
    if (schedule?.Q1O1) horario.push('durante_almuerzo');
    if (schedule?.Q1O2) horario.push('despues_clases');
    if (schedule?.Q1O3) horario.push('manana_fines');
    if (schedule?.Q1O4) horario.push('tarde_fines');
    return horario;
  }
  
  private getSelectedCarreras(): string[] {
    const professions = this.form.get('wanted_profession')?.value;
    const carreras: string[] = [];
    if (professions?.O1) carreras.push('ieme');
    if (professions?.O2) carreras.push('mcm');
    if (professions?.O3) carreras.push('ema');
    if (professions?.O4) carreras.push('mecatronica');
    if (professions?.O5) carreras.push('informatica');
    if (professions?.O6) carreras.push('ciencias');
    return carreras;
  }

  private processSchedule(schedule: any): string[] {
    const horario = [];
    if (schedule?.Q1O1) horario.push('durante_almuerzo');
    if (schedule?.Q1O2) horario.push('despues_clases');
    if (schedule?.Q1O3) horario.push('manana_fines');
    if (schedule?.Q1O4) horario.push('tarde_fines');
    return horario;
  }

  private processCarreras(carreras: any): string[] {
    const carrerasBuscadas = [];
    if (carreras?.O1) carrerasBuscadas.push('ieme');
    if (carreras?.O2) carrerasBuscadas.push('mcm');
    if (carreras?.O3) carrerasBuscadas.push('ema');
    if (carreras?.O4) carrerasBuscadas.push('mecatronica');
    if (carreras?.O5) carrerasBuscadas.push('informatica');
    if (carreras?.O6) carrerasBuscadas.push('ciencias');
    return carrerasBuscadas;
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

  isPageComplete(page: number): boolean {
    const result = (() => {
      switch (page) {
        case 1:
          return this.isPreferencesComplete();
        case 2:
          return this.isWantedProfessionComplete();
        case 3:
          const complete = this.isWantedSkillsComplete();
          return complete;
        case 4:
          return this.isOfferSkillsComplete();
        default:
          return false;
      }
    })();
    return result;
  }

  private isPreferencesComplete(): boolean {
    const scheduleGroup = this.form.get('schedule');
    const methodControl = this.form.get('method');
    const hoursControl = this.form.get('hours');

    const scheduleValid = scheduleGroup?.valid ?? false;
    const methodValid = (methodControl?.value !== '' && methodControl?.valid) ?? false;
    const hoursValid = (hoursControl?.value !== '' && hoursControl?.valid) ?? false;

    const isValid = scheduleValid && methodValid && hoursValid;

    return isValid;
  }


  private isWantedProfessionComplete(): boolean {
    return this.form.get('wanted_profession')?.valid ?? false;
  }

  private isWantedSkillsComplete(): boolean {
    const selectedProfessions = this.form.get('wanted_profession')?.value;
    if (!selectedProfessions) return false;

    // Verificar las habilidades según las profesiones seleccionadas
    if (selectedProfessions.O5) { // Si seleccionó informática
      if (this.userData?.anioLectivo === 'Segundo') {
        const secInfValid = this.form.get('wanted_skills_sec_inf')?.valid ?? false;
        return secInfValid;
      } else if (this.userData?.anioLectivo === 'Tercero') {
        const thirdInfValid = this.form.get('wanted_skills_third_inf')?.valid ?? false;
        return thirdInfValid;
      }
    }
    // Agregar más validaciones según sea necesario para otras carreras
    return true;
  }

  private isOfferSkillsComplete(): boolean {
  if (this.userData?.carrera !== 'Informatica') return true;

  if (this.userData?.anioLectivo === 'Segundo') {
    const secInfValid = this.form.get('offer_skills_sec_inf')?.valid ?? false;
    const allFieldsCompleted = Object.values(this.form.get('offer_skills_sec_inf')?.value ?? {})
      .every(value => value !== null && value !== '' && value !== undefined);
    return secInfValid && allFieldsCompleted;
  } 
  else if (this.userData?.anioLectivo === 'Tercero') {
    const thirdInfGroup = this.form.get('offer_skills_third_inf');
    if (!thirdInfGroup) return false;

    // Obtener los campos requeridos según la mención
    const requiredFields = this.userData?.mencion === 'Programacion movil' 
      ? ['programming1', 'desing', 'cad', 'support1', 'mobile']
      : ['programming1', 'desing', 'cad', 'web1', 'networks1'];

    // Verificar que todos los campos requeridos tengan un valor
    const allRequiredFieldsCompleted = requiredFields.every(field => {
      const value = thirdInfGroup.get(field)?.value;
      return value !== null && value !== '' && value !== undefined;
    });

    return allRequiredFieldsCompleted;
  }

  return false;
}

  get isLastPage(): boolean {
    return this.page === 4;
  }
}

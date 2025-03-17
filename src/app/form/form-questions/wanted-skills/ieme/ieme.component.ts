import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ControlContainer, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonText } from '@ionic/angular/standalone';
import { RegisterService, userCreate } from '../../../../register/data-access/register.service';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ieme',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, IonText, IonList, IonItem, IonLabel, IonSelect, IonSelectOption ], 
  templateUrl: './ieme.component.html',
  styleUrls: ['./ieme.component.scss'],
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupDirective
    }
  ]
})
export class IEMEComponent  implements OnInit {
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);
  private _router = inject(Router);
  private _formGroupDirective = inject(FormGroupDirective);

  form!: FormGroup;
  userData: userCreate | null = null;

  constructor() {}

  async ngOnInit() {
    try {
      const currentUser = this._auth.currentUser;
      if (!currentUser) {
        this._router.navigate(['/login']);
        return;
      }

      this.userData = await this._registerService.getUserData(currentUser.uid);
      this.form = this._formGroupDirective.form;

      // Asegurarnos de que los controles tengan validadores
      if (this.userData?.anioLectivo === 'Segundo') {
        const secInfGroup = this.form.get('wanted_skills_sec_inf');
        if (secInfGroup) {
          Object.keys(secInfGroup.value).forEach(key => {
            const control = secInfGroup.get(key);
            if (control) {
              control.setValidators(Validators.required);
              control.updateValueAndValidity();
            }
          });
        }
      } else {
        const thirdInfGroup = this.form.get('wanted_skills_third_inf');
        if (thirdInfGroup) {
          Object.keys(thirdInfGroup.value).forEach(key => {
            const control = thirdInfGroup.get(key);
            if (control) {
              control.setValidators(Validators.required);
              control.updateValueAndValidity();
            }
          });
        }
      }

      // Monitorear cambios
      const relevantGroup = this.userData?.anioLectivo === 'Segundo' ? 
        'wanted_skills_sec_inf' : 'wanted_skills_third_inf';

    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
    }
  }

  private areAllFieldsCompleted(): boolean {
    const group = this.userData?.anioLectivo === 'Segundo' ?
      this.form.get('wanted_skills_sec_inf') :
      this.form.get('wanted_skills_third_inf');

    if (!group) return false;

    const values = Object.values(group.value);
    const allCompleted = values.every(value => value !== null && value !== '' && value !== undefined);
    
    return allCompleted;
  }
}

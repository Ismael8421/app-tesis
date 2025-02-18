import { Component, OnInit, inject } from '@angular/core';
import { RegisterService, userCreate } from '../../../../register/data-access/register.service';
import { Auth } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroupDirective, ControlContainer, FormGroup } from '@angular/forms';
import { IonItem, IonLabel, IonList, IonSelect, IonSelectOption } from '@ionic/angular/standalone';

@Component({
  selector: 'app-pers-computing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonList, IonItem, IonLabel, IonSelect, IonSelectOption],
  templateUrl: './pers-computing.component.html',
  viewProviders: [{
    provide: ControlContainer,
    useExisting: FormGroupDirective
  }]
})
export class PersComputingComponent implements OnInit {
  private _registerService = inject(RegisterService);
  private _auth = inject(Auth);
  private _router = inject(Router);

  form!: FormGroup;
  userData: userCreate | null = null;

  constructor(private formGroupDir: FormGroupDirective) {}

  async ngOnInit() {
    try {
      const currentUser = this._auth.currentUser;
      if (!currentUser) {
        this._router.navigate(['/login']);
        return;
      }

      this.userData = await this._registerService.getUserData(currentUser.uid);
      this.form = this.formGroupDir.form;

      // Monitorear cambios en los grupos relevantes
      if (this.userData?.anioLectivo === 'Segundo') {
        this.form.get('offer_skills_sec_inf')?.valueChanges.subscribe((values: any) => {
          console.log('Second year offer skills values:', values);
        });
      } else if (this.userData?.anioLectivo === 'Tercero') {
        this.form.get('offer_skills_third_inf')?.valueChanges.subscribe((values: any) => {});
      }
    } catch (error) {
      console.error('Error al cargar datos del perfil:', error);
    }
  }
}
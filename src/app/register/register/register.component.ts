import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { Router } from '@angular/router';
import { PersonalDataComponent } from '../personal-data/personal-data.component';
import { AutoEvaluationComponent } from '../auto-evaluation/auto-evaluation.component';
import { WantedSkillsComponent } from '../wanted-skills/wanted-skills.component';
import { PreferencesComponent } from '../preferences/preferences.component';
import { AvailabilityComponent } from '../availability/availability.component';
import { InterestsComponent } from '../interests/interests.component';
import { StyleWorkComponent } from '../style-work/style-work.component';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault, FormsModule, PersonalDataComponent, AutoEvaluationComponent, WantedSkillsComponent, PreferencesComponent, AvailabilityComponent, InterestsComponent, StyleWorkComponent, IonicModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private _userCreate = inject(RegisterService);
  private _authService = inject(AuthService);
  private _router = inject(Router);
  
  loading = signal(false);

  form: FormGroup;
  page: number = 1; // Página actual del formulario

  constructor() {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      course: new FormControl('', Validators.required),
      profession: new FormControl('', Validators.required),
      autoEvaluation: new FormGroup({
        programming: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        graphicDesign: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        knowledgeME: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        leadership: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        communication: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        resolution: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
      }),
      wantedSkills: new FormGroup({
        programmingW: new FormControl(),
        graphicDesignW: new FormControl(),
        knowledgeMEW: new FormControl(),
        leadershipW: new FormControl(),
        communicationW: new FormControl(),
        resolutionW: new FormControl()
      }),
      preferences: new FormGroup({
        professionWanted: new FormControl('',Validators.required),
        styleWorkP: new FormControl('', Validators.required),
        levelCommitment: new FormControl('', Validators.required)
      }),
      availability: new FormGroup({
        hours: new FormControl('', [Validators.min(1), Validators.max(168), Validators.required]),
        workModality: new FormControl('', Validators.required)
      }),
      interests: new FormGroup({
        softwareDevelop: new FormControl(),
        graphicDesignI: new FormControl(),
        construction: new FormControl(),
        analysis: new FormControl(),
        investigation: new FormControl()
      }),
      styleWork: new FormControl('', Validators.required)
    });
  }

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
        autoevaluacion:{
          comuniacion: this.form.get('autoEvaluation.communication')?.value || 0,
          disenoGrafico: this.form.get('autoEvaluation.graphicDesign')?.value || 0,
          liderazgo: this.form.get('autoEvaluation.leadership')?.value || 0,
          mecanicaElectronica: this.form.get('autoEvaluation.knowledgeME')?.value || 0,
          programacion: this.form.get('autoEvaluation.programming')?.value || 0,
          resolucionProblemas: this.form.get('autoEvaluation.resolution')?.value || 0,
        },
      
        habilidadesBuscadas: {
          comunicacion: this.form.get('wantedSkills.communicationW')?.value || false,
          disenoGrafico: this.form.get('wantedSkills.graphicDesignW')?.value || false,
          liderazgo: this.form.get('wantedSkills.leadershipW')?.value || false,
          mecanicaElectronica: this.form.get('wantedSkills.knowledgeMEW')?.value || false,
          programacion: this.form.get('wantedSkills.programmingW')?.value || false,
          resolucionProblemas: this.form.get('wantedSkills.resolutionW')?.value || false 
        },
      
        preferencias:{
          carrera: this.form.get('preferences.professionWanted')?.value ,
          estiloTrabajoP: this.form.get('preferences.styleWorkP')?.value ,
          nivelCompromiso: this.form.get('preferences.levelCommitment')?.value 
        },
        
        disponibilidad:{
          horasSemanales: this.form.get('availability.hours')?.value ,
          modalidadTrabajo: this.form.get('availability.workModality')?.value
        },
      
        intereses:{
          analisisDatos: this.form.get('interests.analysis')?.value || false,
          construccionDispositivos: this.form.get('interests.construction')?.value || false,
          desarrolloSoftware: this.form.get('interests.softwareDevelop')?.value || false,
          disenoGrafico: this.form.get('interests.graphicDesignI')?.value || false,
          investigacionCientifica: this.form.get('interests.investigation')?.value || false 
        },
        estiloTrabajo: this.form.get('styleWork')?.value
      };

      await this._userCreate.create(uid, userData);
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

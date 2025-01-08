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
      autoEvaluation: new FormGroup({
        programming: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        graphicDesign: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        knowledgeME: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        leadership: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        communication: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        resolution: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
      }),
      wantedSkills: new FormGroup({
        programmingW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        graphicDesignW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        knowledgeMEW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        leadershipW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        communicationW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required]),
        resolutionW: new FormControl('', [Validators.min(1), Validators.max(5), Validators.required])
      }),
      preferences: new FormGroup({
        professionWanted: new FormControl('', Validators.required),
        styleWorkP: new FormControl('', Validators.required),
        levelCommitment: new FormControl('', Validators.required)
      }),
      availability: new FormGroup({
        hours: new FormControl('', Validators.required),
        workModality: new FormControl('', Validators.required)
      }),
      interests: new FormGroup({
        softwareDevelop: new FormControl('', Validators.required),
        graphicDesignI: new FormControl('', Validators.required),
        construction: new FormControl('', Validators.required),
        analysis: new FormControl('', Validators.required),
        investigation: new FormControl('', Validators.required)
      }),
      styleWork: new FormControl('', Validators.required)
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
          comunicacion: this.form.get('wantedSkills.communicationW')?.value ,
          disenoGrafico: this.form.get('wantedSkills.graphicDesignW')?.value ,
          liderazgo: this.form.get('wantedSkills.leadershipW')?.value ,
          mecanicaElectronica: this.form.get('wantedSkills.knowledgeMEW')?.value ,
          programacion: this.form.get('wantedSkills.programmingW')?.value ,
          resolucionProblemas: this.form.get('wantedSkills.resolutionW')?.value 
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
          analisisDatos: this.form.get('interests.analysis')?.value ,
          construccionDispositivos: this.form.get('interests.construction')?.value ,
          desarrolloSoftware: this.form.get('interests.softwareDevelop')?.value ,
          disenoGrafico: this.form.get('interests.graphicDesignI')?.value ,
          investigacionCientifica: this.form.get('interests.investigation')?.value 
        },
        estiloTrabajo: this.form.get('styleWork')?.value
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

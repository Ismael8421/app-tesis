import { NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterService, userCreate } from '../data-access/register.service';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { Router } from '@angular/router';
import { PersonalDataComponent } from '../personal-data/personal-data.component';
import { IonContent, IonAlert } from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    NgIf, 
    NgSwitch, 
    NgSwitchCase, 
    NgSwitchDefault, 
    FormsModule, 
    PersonalDataComponent, 
    IonContent,
    IonAlert
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit, OnDestroy {
  private _userCreate = inject(RegisterService);
  private _authService = inject(AuthService);
  private _router = inject(Router);

  loading = signal(false);
  showExitAlert = signal(false);
  showIncompleteAlert = signal(false);

  // Definir los botones como propiedades del componente
  exitAlertButtons = [
    {
      text: 'Cancelar',
      role: 'cancel',
      handler: () => { this.handleExitResponse(false); }
    },
    {
      text: 'Salir',
      handler: () => { this.handleExitResponse(true); }
    }
  ];

  incompleteAlertButtons = [
    {
      text: 'Entendido',
      handler: () => { this.showIncompleteAlert.set(false); }
    }
  ];

  form: FormGroup;
  private autoSaveInterval: any;

  constructor() {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      course: new FormControl('', Validators.required),
      profession: new FormControl('', Validators.required),
      mencion: new FormControl('') 
    });
  }

  ngOnInit() {
    // Restaurar datos guardados si existen
    if (this._authService.currentUser) {
      const savedData = this._userCreate.getSavedFormData(this._authService.currentUser.uid);
      if (savedData) {
        this.restoreFormData(savedData);
      }
    }
    
    // Configurar guardado automático cada 10 segundos
    this.autoSaveInterval = setInterval(() => {
      this.saveFormProgress();
    }, 10000);
    
    // Configurar listener para eventos beforeunload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  ngOnDestroy() {
    // Limpiar el intervalo al destruir el componente
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Remover el listener de beforeunload
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    // Guardar progreso al salir del componente
    this.saveFormProgress();
  }

  // Manejar el evento de cierre del navegador/app
  handleBeforeUnload(event: BeforeUnloadEvent) {
    // Guardar el progreso actual
    this.saveFormProgress();
    
    // Mostrar un mensaje pidiendo confirmación (dependiendo del navegador puede no mostrarse)
    const message = '¿Estás seguro de que quieres salir? Los datos no guardados pueden perderse.';
    event.returnValue = message;
    return message;
  }

  // Guardar el progreso del formulario en localStorage
  saveFormProgress() {
    if (!this._authService.currentUser || !this.form.dirty) return;
    
    const uid = this._authService.currentUser.uid;
    const formData: Partial<userCreate> = {
      nombreUsuario: this.form.get('username')?.value || '',
      nombre: this.form.get('name')?.value || '',
      apellido: this.form.get('lastName')?.value || '',
      anioLectivo: this.form.get('course')?.value || '',
      carrera: this.form.get('profession')?.value || '',
      mencion: this.form.get('mencion')?.value || ''
    };
    
    this._userCreate.saveFormData(uid, formData);
  }
  
  // Restaurar datos al formulario
  restoreFormData(data: Partial<userCreate>) {
    if (data.nombreUsuario) this.form.get('username')?.setValue(data.nombreUsuario);
    if (data.nombre) this.form.get('name')?.setValue(data.nombre);
    if (data.apellido) this.form.get('lastName')?.setValue(data.apellido);
    if (data.anioLectivo) this.form.get('course')?.setValue(data.anioLectivo);
    if (data.carrera) this.form.get('profession')?.setValue(data.carrera);
    if (data.mencion) this.form.get('mencion')?.setValue(data.mencion);
  }

  // Intentar salir del formulario
  attemptToExit() {
    if (this.form.dirty) {
      this.showExitAlert.set(true);
    } else {
      this._router.navigateByUrl('/auth/sign-in');
    }
  }

  // Manejar la respuesta del alerta de salida
  handleExitResponse(confirmed: boolean) {
    this.showExitAlert.set(false);
    if (confirmed) {
      this.saveFormProgress();
      this._router.navigateByUrl('/auth/sign-in');
    }
  }

  // Enviar el formulario
  async submit() {
    if (this.form.invalid) {
      // Marcar campos como touched para mostrar errores
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        control?.markAsTouched();
      });
      
      this.showIncompleteAlert.set(true);
      return;
    }

    try {
      this.loading.set(true);
      const user = this._authService.currentUser;

      if (!user || !user.uid) {
        console.error('No se encontró un usuario autenticado.');
        return;
      }

      const uid = user.uid;
      const { username, name, lastName, course, profession, mencion } = this.form.value;

      const userData: userCreate = {
        nombreUsuario: username || '',
        nombre: name || '',
        apellido: lastName || '',
        anioLectivo: course || '',
        carrera: profession || '',
        mencion: mencion || '' // Si no hay mención, será string vacío
      };

      await this._userCreate.create(uid, userData);
      this._router.navigateByUrl('/menu');

    } catch (error) {
      console.error('Error al crear el documento:', error);
    } finally {
      this.loading.set(false);
    }
  }
  
  // Función auxiliar para verificar si una carrera requiere mención
  private requiereMencion(carrera: string): boolean {
    return ['Informática', 'IEME', 'MCM', 'EMA', 'Ciencias'].includes(carrera);
  }
}
import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-personal-data',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, IonicModule],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss'
})
export class PersonalDataComponent implements OnInit {
  form!: FormGroup;
  showMencion: boolean = false; 
  menciones: { [key: string]: string[] } = {
    'Informática': [
      'Programación móvil',
      'Aplicaciones web'
    ],
    'IEME': [
      'Electrónica digital',
      'Sistemas eléctricos de Potencia'
    ],
    'MCM': [
      'Diseño y automatización de maquinas y mecanismos',
      'Mecánica de precisión y producción de seria'
    ],
    'EMA': [
      'Electrotecnia automotriz',
      'Mantenimiento automotriz'
    ],
    'Ciencias': [
      'Matemática y Física avanzada',
      'Ciencias de la salud',
      'Ciencias de la política'
    ]
  };

  mencionesActuales: string[] = [];
  
  constructor(private controlContainer: ControlContainer) { }

  ngOnInit() {
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;

    this.form.get('course')?.valueChanges.subscribe(() => this.checkMencionVisibility());
    this.form.get('profession')?.valueChanges.subscribe(() => this.checkMencionVisibility());
  }

  // personal-data.component.ts
checkMencionVisibility() {
  const course = this.form.get('course')?.value;
  const profession = this.form.get('profession')?.value;
  
  // Solo mostrar mención para tercero y carreras con mención
  this.showMencion = course === 'Tercero' && Boolean(this.menciones[profession]);
  
  const mencionControl = this.form.get('mencion');
  
  if (this.showMencion && this.menciones[profession]) {
    this.mencionesActuales = this.menciones[profession];
    // Solo agregar validación si es tercero y no es Mecatrónica
    if (course === 'Tercero' && profession !== 'Mecatrónica') {
      mencionControl?.setValidators(Validators.required);
    }
  } else {
    this.mencionesActuales = [];
    mencionControl?.setValue('');
    mencionControl?.clearValidators();
  }
  
  mencionControl?.updateValueAndValidity();
}

}

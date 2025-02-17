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

  // Array de carreras para mostrar/valor
  carreras = [
    { display: 'IEME', value: 'IEME' },
    { display: 'MCM', value: 'MCM' },
    { display: 'EMA', value: 'EMA' },
    { display: 'Mecatrónica', value: 'Mecatronica' },
    { display: 'Informática', value: 'Informatica' },
    { display: 'Ciencias', value: 'Ciencias' }
  ];

  // Objeto con las menciones manteniendo las claves normalizadas
  // Objeto con las menciones como se muestran en la interfaz
  menciones: { [key: string]: Array<{valor: string, display: string}> } = {
    'Informatica': [
      {valor: 'Programacion movil', display: 'Programación móvil'},
      {valor: 'Aplicaciones web', display: 'Aplicaciones web'}
    ],
    'IEME': [
      {valor: 'Electronica digital', display: 'Electrónica digital'},
      {valor: 'Sistemas electricos de Potencia', display: 'Sistemas eléctricos de Potencia'}
    ],
    'MCM': [
      {valor: 'Diseno y automatizacion de maquinas y mecanismos', display: 'Diseño y automatización de máquinas y mecanismos'},
      {valor: 'Mecanica de precision y produccion de serie', display: 'Mecánica de precisión y producción de serie'}
    ],
    'EMA': [
      {valor: 'Electrotecnia automotriz', display: 'Electrotecnia automotriz'},
      {valor: 'Mantenimiento automotriz', display: 'Mantenimiento automotriz'}
    ],
    'Ciencias': [
      {valor: 'Matematica y Fisica avanzada', display: 'Matemática y Física avanzada'},
      {valor: 'Ciencias de la salud', display: 'Ciencias de la salud'},
      {valor: 'Ciencias de la politica', display: 'Ciencias de la política'}
    ]
  };

  mencionesActuales: Array<{valor: string, display: string}> = [];

  // Objeto que mapea los valores mostrados con sus equivalentes normalizados
  mencionesNormalizadas: { [key: string]: string } = {
    'Programación móvil': 'Programacion movil',                // Debe coincidir exactamente con el valor mostrado
    'Aplicaciones web': 'Aplicaciones web',
    'Electrónica digital': 'Electronica digital',
    'Sistemas eléctricos de Potencia': 'Sistemas electricos de Potencia',
    'Diseño y automatización de máquinas y mecanismos': 'Diseno y automatizacion de maquinas y mecanismos',
    'Mecánica de precisión y producción de serie': 'Mecanica de precision y produccion de serie',
    'Electrotecnia automotriz': 'Electrotecnia automotriz',
    'Mantenimiento automotriz': 'Mantenimiento automotriz',
    'Matemática y Física avanzada': 'Matematica y Fisica avanzada',
    'Ciencias de la salud': 'Ciencias de la salud',
    'Ciencias de la política': 'Ciencias de la politica'
  };


  constructor(private controlContainer: ControlContainer) { }

  ngOnInit() {
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;

    // Suscribirse a los cambios
    this.form.get('course')?.valueChanges.subscribe(() => this.checkMencionVisibility());
    this.form.get('profession')?.valueChanges.subscribe(() => this.checkMencionVisibility());

    // Suscribirse a los cambios en mencion para normalizar el valor
    this.form.get('mencion')?.valueChanges.subscribe(value => {
      if (value && this.mencionesNormalizadas[value]) {
        const normalizedValue = this.mencionesNormalizadas[value];
        this.form.get('mencion')?.setValue(normalizedValue, { emitEvent: false });
      }
    });
  }

  checkMencionVisibility() {
    const course = this.form.get('course')?.value;
    const profession = this.form.get('profession')?.value;
    
    this.showMencion = course === 'Tercero' && Boolean(this.menciones[profession]);
    
    const mencionControl = this.form.get('mencion');
    
    if (this.showMencion && this.menciones[profession]) {
      this.mencionesActuales = this.menciones[profession];
      if (course === 'Tercero' && profession !== 'Mecatronica') {
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

import { CommonModule } from '@angular/common';
import { Component, OnInit} from '@angular/core';
import { ControlContainer, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox, IonItem, IonLabel, IonList, IonRadio, IonRadioGroup, IonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [ ReactiveFormsModule, CommonModule, IonText, IonList, IonItem, IonLabel, IonCheckbox, IonRadioGroup, IonRadio ],
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss'],
})
export class PreferencesComponent implements OnInit {
  form!: FormGroup;

  constructor(private controlContainer: ControlContainer) {}

  ngOnInit() {
    this.form = this.controlContainer.control as FormGroup;
    
    // Suscribirse a los cambios del formulario para debug
    // this.form.valueChanges.subscribe(() => {
    //   console.log('Schedule valid:', this.form.get('schedule')?.valid);
    //   console.log('Method valid:', this.form.get('method')?.valid);
    //   console.log('Hours valid:', this.form.get('hours')?.valid);
    //   console.log('Form valid:', this.form.valid);
    // });
  }

  // Método helper para verificar si schedule tiene al menos una selección
  toggleCheckbox(controlName: string) {
    const control = this.form.get(`schedule.${controlName}`);
    if (control) {
      control.setValue(!control.value);
    }
  }

  selectRadioOption(groupName: string, value: string) {
    const control = this.form.get(groupName);
    if (control) {
      control.setValue(value);
    }
  }
}

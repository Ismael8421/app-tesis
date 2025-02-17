import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ControlContainer, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-wanted-profession',
  standalone: true,
  imports: [ ReactiveFormsModule, CommonModule, IonicModule ],
  templateUrl: './wanted-profession.component.html',
  styleUrls: ['./wanted-profession.component.scss'],
})
export class WantedProfessionComponent  implements OnInit {
  form!: FormGroup;

  constructor(private controlContainer: ControlContainer) {}

  ngOnInit() {
    this.form = this.controlContainer.control as FormGroup;

  }

  toggleCheckbox(controlName: string) {
    const control = this.form.get(`wanted_profession.${controlName}`);
    if (control) {
      control.setValue(!control.value);
    }
  }

  // Helper para verificar si al menos una opción está seleccionada
  hasSelection(): boolean {
    const professionGroup = this.form.get('wanted_profession');
    if (!professionGroup) return false;
    
    const values = Object.values(professionGroup.value);
    return values.some(value => value === true);
  }
}

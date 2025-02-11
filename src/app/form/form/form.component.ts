import { Component } from '@angular/core';
import { PreferencesComponent } from '../form-questions/preferences/preferences.component';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { WantedProfessionComponent } from '../form-questions/wanted-profession/wanted-profession.component';
import { ComputingComponent } from '../form-questions/wanted-skills/computing/computing.component';
import { PersComputingComponent } from '../form-questions/offer-skills/pers-computing/pers-computing.component';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [ 
    CommonModule,
    ReactiveFormsModule,
    PreferencesComponent,
    WantedProfessionComponent,
    ComputingComponent,
    PersComputingComponent
  ],
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent {

  // form: FormGroup;
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

  constructor() {
    
  }
}

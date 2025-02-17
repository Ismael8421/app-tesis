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

  ngOnInit() {
    // Obtiene el FormGroup del componente padre
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;
  }

  constructor(private controlContainer: ControlContainer) {}

}

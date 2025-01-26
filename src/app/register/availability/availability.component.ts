import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer, FormGroupDirective } from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule, NgIf, IonicModule],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.scss'
})
export class AvailabilityComponent implements OnInit{
  form!: FormGroup;

  ngOnInit() {
    // Obtiene el FormGroup del componente padre
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;
  }

  constructor(private controlContainer: ControlContainer) {}

}
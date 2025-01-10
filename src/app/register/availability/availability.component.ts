import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer, FormGroupDirective } from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule, NgIf],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.css'
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
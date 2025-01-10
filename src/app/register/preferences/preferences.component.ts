import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer, FormGroupDirective } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css'
})
export class PreferencesComponent implements OnInit{
  form!: FormGroup;

  ngOnInit() {
    // Obtiene el FormGroup del componente padre
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;
  }

  constructor(private controlContainer: ControlContainer) {}

}
import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer, FormGroupDirective } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-auto-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auto-evaluation.component.html',
  styleUrl: './auto-evaluation.component.css'
})
export class AutoEvaluationComponent implements OnInit{
  form!: FormGroup;

  ngOnInit() {
    // Obtiene el FormGroup del componente padre
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;
  }

  constructor(private controlContainer: ControlContainer) {}

}
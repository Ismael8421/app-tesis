import { Component, OnInit } from '@angular/core';
import { FormGroup, ControlContainer } from '@angular/forms';
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
export class PersonalDataComponent implements OnInit{
  form!: FormGroup;

  ngOnInit() {
    const parentForm = this.controlContainer.control as FormGroup;
    this.form = parentForm;
  }

  constructor(private controlContainer: ControlContainer) {}

}

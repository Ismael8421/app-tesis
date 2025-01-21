import { CommonModule, NgFor } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { DragDropModule } from '@angular/cdk/drag-drop';
register();

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [NgFor, DragDropModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent {

}
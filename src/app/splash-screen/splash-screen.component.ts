import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent  implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
    // Navegar a la página de inicio de sesión después de mostrar el splash
    setTimeout(() => {
      this.router.navigate(['/auth/sign-in']);
    }, 3000); // 3 segundos
  }

}

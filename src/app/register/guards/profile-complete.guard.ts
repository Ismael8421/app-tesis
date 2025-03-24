// src/app/guards/profile-complete.guard.ts
import { Injectable, inject } from '@angular/core';
import { CanActivate, CanLoad, Router, UrlTree } from '@angular/router';
import { Observable, from, map, of, switchMap, take } from 'rxjs';
import { AuthService } from '../../account/auth/data-access/auth.service';
import { RegisterService } from '../data-access/register.service';

@Injectable({
    providedIn: 'root'
  })
  export class ProfileCompleteGuard {
    private _authService = inject(AuthService);
    private _registerService = inject(RegisterService);
    private _router = inject(Router);
  
    canActivateChild(): Observable<boolean | UrlTree> {
      // Si no hay usuario actual, se manejará con el privateGuard
      if (!this._authService.currentUser) {
        return of(this._router.createUrlTree(['/auth/sign-in']));
      }
  
      const uid = this._authService.currentUser.uid;
      
      return from(this._registerService.getUserData(uid)).pipe(
        take(1),
        map(userData => {
          // Verificar si el perfil está completo
          const isComplete = !!userData && 
            !!userData.nombreUsuario && 
            !!userData.nombre && 
            !!userData.apellido && 
            !!userData.anioLectivo && 
            !!userData.carrera;
  
          if (isComplete) {
            // El perfil está completo, permitir la navegación
            return true;
          } else {
            // El perfil no está completo, redirigir al registro
            return this._router.createUrlTree(['/register']);
          }
        })
      );
    }
  }
  
  // Factory function para usar en las rutas
  export function profileCompleteGuard() {
    return (route: any, state: any) => {
      return inject(ProfileCompleteGuard).canActivateChild();
    };
  }
  
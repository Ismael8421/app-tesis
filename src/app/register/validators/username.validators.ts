// Crear este archivo en: src/app/register/validators/username.validators.ts

import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, debounceTime, distinctUntilChanged, first, map, of, switchMap } from 'rxjs';
import { RegisterService } from '../data-access/register.service';

export class UsernameValidators {
  static usernameExists(registerService: RegisterService): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || control.value === '') {
        return of(null);
      }
      
      // Esperar un momento antes de verificar para evitar demasiadas llamadas a la API
      return of(control.value).pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(username => registerService.isUsernameTaken(username)),
        map(exists => exists ? { usernameExists: true } : null),
        first(),
        catchError(() => of(null))
      );
    };
  }
}
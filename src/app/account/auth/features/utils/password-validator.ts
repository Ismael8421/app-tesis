import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordStrength {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  valid: boolean;
}

export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (!value) {
      return null;
    }

    const hasMinLength = value.length >= 8;
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value);

    const passwordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

    const passwordStrength: PasswordStrength = {
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
      valid: passwordValid
    };

    return !passwordValid ? { passwordStrength } : null;
  };
}

// Función para obtener un mensaje descriptivo basado en los criterios de seguridad fallidos
export function getPasswordStrengthMessage(strength: PasswordStrength): string {
  if (strength.valid) {
    return 'Contraseña segura';
  }

  const messages: string[] = [];
  
  if (!strength.hasMinLength) {
    messages.push('Mínimo 8 caracteres');
  }
  if (!strength.hasUpperCase) {
    messages.push('Al menos una mayúscula');
  }
  if (!strength.hasLowerCase) {
    messages.push('Al menos una minúscula');
  }
  if (!strength.hasNumber) {
    messages.push('Al menos un número');
  }
  if (!strength.hasSpecialChar) {
    messages.push('Al menos un carácter especial');
  }

  return messages.join(', ');
}
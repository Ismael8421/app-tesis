import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class FormStateService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  
  private _isFormComplete = new BehaviorSubject<boolean>(false);
  isFormComplete$ = this._isFormComplete.asObservable();

  async checkFormCompletion(userId: string): Promise<boolean> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        console.log('No hay usuario autenticado');
        return false;
      }

      const userDoc = await getDoc(doc(this.firestore, 'usuarios', userId));
      if (!userDoc.exists()) {
        console.log('Documento de usuario no encontrado');
        return false;
      }

      const data = userDoc.data();
      const isComplete = data?.['formCompleted'] ?? false;
      
      console.log('Estado del formulario:', isComplete);

      this._isFormComplete.next(isComplete);
      return isComplete;
    } catch (error) {
      console.error('Error detallado al verificar el formulario:', error);
      return false;
    }
  }

  async updateFormCompletion(userId: string, isComplete: boolean): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'usuarios', userId);
      
      await updateDoc(userDocRef, {
        formCompleted: isComplete,
        updatedAt: new Date()
      });

      this._isFormComplete.next(isComplete);
      console.log('Estado del formulario actualizado:', isComplete);
    } catch (error) {
      console.error('Error al actualizar estado del formulario:', error);
      throw error;
    }
  }
}
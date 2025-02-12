import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc, DocumentReference  } from '@angular/fire/firestore';

export interface formCreate {
  horario:{
    durante_almuezo: boolean,
    despues_clases: boolean,
    manana_fines: boolean,
    tarde_fines: boolean
  }
  metodo: string;
  horas: string;
}

@Injectable({
  providedIn: 'root'
})
export class FormService {
  private _firestore = inject(Firestore);
  
  constructor() { }

  async saveFormData(uid: string, formData: formCreate): Promise<void> {
    try {
      const userDocRef = doc(this._firestore, 'usuarios', uid);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        // Obtener datos existentes y combinarlos con los nuevos
        const existingData = docSnap.data();
        await updateDoc(userDocRef, {
          ...existingData,  // Mantener todos los datos existentes
          horario: formData.horario,
          metodo: formData.metodo,
          horas: formData.horas
        });
      } else {
        // Si no existe el documento, crearlo
        await setDoc(userDocRef, formData);
      }
    } catch (error) {
      console.error('Error al guardar los datos del formulario:', error);
      throw error;
    }
  }

  // Obtener datos del formulario
  async getFormData(uid: string): Promise<formCreate | null> {
    try {
      const userDocRef = doc(this._firestore, 'usuarios', uid);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as formCreate;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener los datos del formulario:', error);
      throw error;
    }
  }
}

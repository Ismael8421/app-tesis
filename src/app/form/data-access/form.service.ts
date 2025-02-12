import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc, DocumentReference  } from '@angular/fire/firestore';

export interface formCreate {
  horario: string[];
  metodo: string;
  horas: string;
  carrera_buscada: string[];
  habilidad_buscada_seg?: {
    programacion: string;
    soporte: string;
    web: string;
    redes: string;
  };
  habilidad_buscada_ter?: {
    programacion: string;
    diseño: string;
    cad: string;
    soporte: string;
    mobile: string;
    web: string;
    redes: string;
  };
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
          horas: formData.horas,
          carrera_buscada: formData.carrera_buscada,
          habilida_buscada_seg: formData.habilidad_buscada_seg,
          habilidades_buscada_ter: formData.habilidad_buscada_ter,
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

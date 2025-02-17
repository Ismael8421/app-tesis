import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';

//habilidades buscadas
export interface habilid_inf_seg {
  programacion?: string;
  soporte?: string;
  web?: string;
  redes?: string;
}
export interface habilid_inf_ter {
  programacion?: string;
  diseño?: string;
  cad?: string;
  soporte?: string;
  mobile?: string;
  web?: string;
  redes?: string;
}

//habilidades ofrecidas
export interface habilid_inf_seg_of {
  programacion?: string;
  soporte?: string;
  web?: string;
  redes?: string;
}
export interface habilid_inf_ter_of {
  programacion?: string;
  diseño?: string;
  cad?: string;
  soporte?: string;
  mobile?: string;
  web?: string;
  redes?: string;
}

export interface formCreate {
  horario: string[];
  metodo: string;
  horas: string;
  carrera_buscada: string[];
  habilidad_buscada_seg?: {
    informatica_seg?: habilid_inf_seg
  };
  habilidad_buscada_ter?: {
    informatica_ter?: habilid_inf_ter
  };
  habilidad_ofrecida_seg?: {
    informatica_seg_of?: habilid_inf_seg_of
  };
  habilidad_ofrecida_ter?: {
    informatica_ter_of?: habilid_inf_ter_of
  };
}

@Injectable({
  providedIn: 'root'
})
export class FormService {
  private _firestore = inject(Firestore);
  
  private getCollectionName(carrera: string): string {
    return carrera.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "");
  }

  private cleanObject(obj: any): any {
    // Si el objeto es null o undefined, retornamos undefined
    if (obj === null || obj === undefined) return undefined;
    
    // Si es un array, filtramos los elementos null/undefined
    if (Array.isArray(obj)) {
      const cleaned = obj.filter(item => item != null);
      return cleaned.length > 0 ? cleaned : undefined;
    }
    
    // Si es un objeto, lo procesamos recursivamente
    if (typeof obj === 'object') {
      const cleaned = Object.entries(obj).reduce((acc, [key, value]) => {
        const cleanedValue = this.cleanObject(value);
        if (cleanedValue !== undefined) {
          acc[key] = cleanedValue;
        }
        return acc;
      }, {} as any);
      
      // Si el objeto limpio está vacío, retornamos undefined
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    
    // Para valores primitivos, retornamos el valor si no es null/undefined
    return obj;
  }

  async saveFormData(uid: string, formData: formCreate): Promise<void> {
    try {
      // Obtener la carrera del usuario
      const generalUserDoc = doc(this._firestore, `usuarios/${uid}`);
      const generalUserSnap = await getDoc(generalUserDoc);
      
      if (!generalUserSnap.exists()) {
        throw new Error('No se encontró el usuario en la colección general');
      }

      const { carrera } = generalUserSnap.data();
      const collectionName = this.getCollectionName(carrera);
      
      // Limpiar los datos antes de guardarlos
      const cleanedData = this.cleanObject(formData);
      
      // Obtener el documento del usuario
      const userCarreraDoc = doc(this._firestore, `${collectionName}/${uid}`);
      const userCarreraSnap = await getDoc(userCarreraDoc);
      
      if (userCarreraSnap.exists()) {
        const existingData = userCarreraSnap.data();
        // Combinar datos existentes con nuevos datos limpiados
        const updatedData = {
          ...existingData,
          ...cleanedData
        };
        
        // Actualizar solo los campos que tienen valores
        await updateDoc(userCarreraDoc, updatedData);
      } else {
        throw new Error('No se encontró el documento del usuario en su colección específica');
      }
    } catch (error) {
      console.error('Error al guardar los datos del formulario:', error);
      throw error;
    }
  }

  async getFormData(uid: string): Promise<formCreate | null> {
    try {
      // Primero obtenemos la carrera del usuario
      const generalUserDoc = doc(this._firestore, `usuarios/${uid}`);
      const generalUserSnap = await getDoc(generalUserDoc);
      
      if (!generalUserSnap.exists()) {
        return null;
      }

      const { carrera } = generalUserSnap.data();
      const collectionName = this.getCollectionName(carrera);
      
      // Obtenemos los datos del documento específico de la carrera
      const userCarreraDoc = doc(this._firestore, `${collectionName}/${uid}`);
      const userCarreraSnap = await getDoc(userCarreraDoc);
      
      if (userCarreraSnap.exists()) {
        const data = userCarreraSnap.data();
        return {
          horario: data['horario'],
          metodo: data['metodo'],
          horas: data['horas'],
          carrera_buscada: data['carrera_buscada'],
          habilidad_buscada_seg_inf: data['habilidad_buscada_seg'],
          habilidad_buscada_ter_inf: data['habilidad_buscada_ter'],
        } as formCreate;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener los datos del formulario:', error);
      throw error;
    }
  }
}
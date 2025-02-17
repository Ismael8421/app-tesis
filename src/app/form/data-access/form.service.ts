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

  async saveFormData(uid: string, formData: formCreate): Promise<void> {
    try {
      console.log('Iniciando guardado de datos para uid:', uid);
      
      // 1. Actualizar documento del usuario
      const generalUserDoc = doc(this._firestore, 'usuarios', uid);
      await updateDoc(generalUserDoc, {
        formCompleted: true
      });
      console.log('Estado de formulario actualizado en documento general');

      // 2. Obtener la carrera
      const userSnap = await getDoc(generalUserDoc);
      if (!userSnap.exists()) {
        throw new Error('Usuario no encontrado');
      }
      const { carrera } = userSnap.data();
      console.log('Carrera del usuario:', carrera);

      // 3. Preparar el nombre de la colección
      const collectionName = carrera.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");
      console.log('Nombre de colección normalizado:', collectionName);

      // 4. Guardar datos en la colección específica
      const carreraDoc = doc(this._firestore, collectionName, uid);
      await setDoc(carreraDoc, formData, { merge: true });
      console.log('Datos guardados en colección específica');

      return;
    } catch (error) {
      console.error('Error detallado en saveFormData:', error);
      throw error;
    }
  }
}
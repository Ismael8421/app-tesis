import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';

//habilidades buscadas segundos
export interface habilidad_ieme_seg {
  instalacionesSeg?: string;
  electricidadSeg?: string;
  electronicaSeg?: string;
  automatizacionSeg?: string;
}

export interface habilidad_mcm_seg {
  soldaduraMcmSeg?: string;
  fresadoraSeg?: string;
  tornoSeg?: string;
  dibujoMcmSeg?: string;
}

export interface habilidad_ema_seg {
  sistemasSeg?: string;
  electronicaSeg?: string;
  mantenimientoSeg?: string;
}

export interface habilidad_mec_seg {
  electronicaDigital?: string;
  cncMecSeg?: string;
  manufacturaMecSeg?: string;
  automatizacionMecSeg?: string;
}

export interface habilid_inf_seg {
  programacion?: string;
  soporte?: string;
  web?: string;
  redes?: string;
}

export interface habilidad_ciencias_seg {
  laboratorio?: string;
  psicologia?: string;
  redaccionCreativaSeg?: string;
}

//habilidades buscadas terceros
export interface habilidad_ieme_ter {
  electrotecnia?: string;
  instalaciones?: string;
  automatismosEle?: string;
  electronica?: string;
  potencia?: string;
  maquinas?: string;
  industrial?: string;
  microcontroladores?: string;
  electronicaAplicada?: string;
  comunicaciones?: string;
  redesComputadoras?: string;
}

export interface habilidad_mec_ter {
  metrologia?: string;
  metalurgia?: string;
  soldaduraMcm?: string;
  fresado?: string;
  torno?: string;
  neumatica?: string;
  fabricacion?: string;
  dibujoMcm?: string;
  automatizacionMcm?: string;
  maquinasMcm?: string;
  moldes?: string;
}

export interface habilidad_ema_ter {
  motores?: string;
  seguridad?: string;
  sistemasElectronicos?: string;
  sistemasElectricos?: string;
  dibujoEma?: string;
  mantenimiento?: string;
  automotriz?: string;
}

export interface habilidad_ciencias_ter {
  redaccionCreativa?: string;
  dibujoCiencias?: string;
  investigacion?: string;
  biologia?: string;
  morfologia?: string;
  sociologia?: string;
  politica?: string;
  matematica?: string;
  fisica?: string;
}

export interface habilidad_mec_ter {
  microcontroladores?: string;
  servomecanismos?: string;
  automatizacion?: string;
  dibujoMec?: string;
  simulacion?: string;
  programacionMec?: string;
  soldadura?: string;
  manufactura?: string;
  cnc?: string;
}

export interface habilid_inf_ter {
  programacion?: string;
  diseno?: string;
  cad?: string;
  soporte?: string;
  movil?: string;
  web?: string;
  redes?: string;
}

//habilidades ofrecidas segundos
export interface habilidad_ieme_seg_of {
  instalacionesSeg?: string;
  electricidadSeg?: string;
  electronicaSeg?: string;
  automatizacionSeg?: string;
}

export interface habilidad_mcm_seg_of {
  soldaduraMcmSeg?: string;
  fresadoraSeg?: string;
  tornoSeg?: string;
  dibujoMcmSeg?: string;
}

export interface habilidad_ema_seg_of {
  sistemasSeg?: string;
  electronicaSeg?: string;
  mantenimientoSeg?: string;
}

export interface habilidad_mec_seg_of {
  electronicaDigital?: string;
  cncMecSeg?: string;
  manufacturaMecSeg?: string;
  automatizacionMecSeg?: string;
}

export interface habilid_inf_seg_of {
  programacion?: string;
  soporte?: string;
  web?: string;
  redes?: string;
}

export interface habilidad_ciencias_seg_of {
  laboratorio?: string;
  psicologia?: string;
  redaccionCreativaSeg?: string;
}

//habilidades ofrecidas terceros
export interface habilidad_ieme_ter_of {
  electrotecnia?: string;
  instalaciones?: string;
  automatismosEle?: string;
  electronica?: string;
  potencia?: string;
  maquinas?: string;
  industrial?: string;
  microcontroladores?: string;
  electronicaAplicada?: string;
  comunicaciones?: string;
  redesComputadoras?: string;
}

export interface habilidad_mcm_ter_of {
  metrologia?: string;
  metalurgia?: string;
  soldaduraMcm?: string;
  fresado?: string;
  torno?: string;
  neumatica?: string;
  fabricacion?: string;
  dibujoMcm?: string;
  automatizacionMcm?: string;
  maquinasMcm?: string;
  moldes?: string;
}

export interface habilidad_ema_ter_of {
  motores?: string;
  seguridad?: string;
  sistemasElectronicos?: string;
  sistemasElectricos?: string;
  dibujoEma?: string;
  mantenimiento?: string;
  automotriz?: string;
}

export interface habilidad_mec_ter_of{
  microcontroladores?: string;
  servomecanismos?: string;
  automatizacion?: string;
  dibujoMec?: string;
  simulacion?: string;
  programacionMec?: string;
  soldadura?: string;
  manufactura?: string;
  cnc?: string;
}

export interface habilid_inf_ter_of {
  programacion?: string;
  diseno?: string;
  cad?: string;
  soporte?: string;
  movil?: string;
  web?: string;
  redes?: string;
}

export interface ciencias_ter_of {
  redaccionCreativa?: string;
  dibujoCiencias?: string;
  investigacion?: string;
  biologia?: string;
  morfologia?: string;
  sociologia?: string;
  politica?: string;
  matematica?: string;
  fisica?: string;
}

export interface formCreate {
  horario: string[];
  metodo: string;
  horas: string;
  carrera_buscada: string[];
  habilidad_buscada_seg?: {
    ieme_seg?: habilidad_ieme_seg,
    mcm_seg?: habilidad_mcm_seg,
    ema_seg?: habilidad_ema_seg,
    mec_seg?: habilidad_mec_seg,
    informatica_seg?: habilid_inf_seg,
    ciencias_seg?: habilidad_ciencias_seg
  };
  habilidad_buscada_ter?: {
    ieme_ter?: habilidad_ieme_ter,
    mcm_ter?: habilidad_mec_ter,
    ema_ter?: habilidad_ema_ter,
    mecatronica_ter?: habilidad_mec_ter,
    informatica_ter?: habilid_inf_ter,
    ciecias_ter?: habilidad_ciencias_ter
  };
  habilidad_ofrecida_seg?: {
    ieme_seg_of?: habilidad_ieme_seg_of,
    mcm_seg_of?: habilidad_mcm_seg_of,
    ema_seg_of?: habilidad_ema_seg_of,
    mec_seg_of?: habilidad_mec_seg_of,
    informatica_seg_of?: habilid_inf_seg_of,
    ciencias_seg_of?: habilidad_ciencias_seg_of
  };
  habilidad_ofrecida_ter?: {
    ieme_ter_of?: habilidad_ieme_ter_of,
    mcm_ter_of?: habilidad_mcm_ter_of,
    ema_ter_of?: habilidad_ema_ter_of,
    mec_ter_of?: habilidad_mec_ter_of,
    informatica_ter_of?: habilid_inf_ter_of,
    ciencias_ter_of?: ciencias_ter_of
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

  async getFormData(uid: string): Promise<formCreate | null> {
    try {
      // 1. Primero obtener el documento del usuario para saber su carrera
      const generalUserDoc = doc(this._firestore, 'usuarios', uid);
      const userSnap = await getDoc(generalUserDoc);

      if (!userSnap.exists()) {
        throw new Error('Usuario no encontrado');
      }

      const { carrera } = userSnap.data();

      // 2. Normalizar el nombre de la colección (igual que en saveFormData)
      const collectionName = carrera.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");

      // 3. Obtener los datos del formulario de la colección específica
      const carreraDoc = doc(this._firestore, collectionName, uid);
      const formSnap = await getDoc(carreraDoc);

      if (!formSnap.exists()) {
        return null;
      }

      return formSnap.data() as formCreate;

    } catch (error) {
      console.error('Error al obtener datos del formulario:', error);
      throw error;
    }
  }
}
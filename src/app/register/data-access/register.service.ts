import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, setDoc, doc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

export interface userCreate {
  nombreUsuario: string;
  nombre: string;
  apellido: string;
  anioLectivo: string;
  carrera: string;
  uid?: string;
  autoevaluacion: {
    comuniacion: number;
    disenoGrafico: number;
    liderazgo: number;
    mecanicaElectronica: number;
    programacion: number;
    resolucionProblemas: number;
  }

  habilidadesBuscadas: {
    comunicacion: boolean;
    disenoGrafico: boolean;
    liderazgo: boolean;
    mecanicaElectronica: boolean;
    programacion: boolean;
    resolucionProblemas: boolean
  }

  preferencias: {
    carrera: string;
    estiloTrabajoP: string;
    nivelCompromiso: string;
  }

  disponibilidad: {
    horasSemanales: number;
    modalidadTrabajo: string;
  }

  intereses: {
    analisisDatos: boolean;
    construccionDispositivos: boolean;
    desarrolloSoftware: boolean;
    disenoGrafico: boolean;
    investigacionCientifica: boolean;
  }
  estiloTrabajo: string;
}


@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private _firestore = inject(Firestore);

  async create(uid: string, user: userCreate) {
    try {
      const userWithUID = { ...user, uid };
      const userDoc = doc(this._firestore, `usuarios/${uid}`); // Usar UID como nombre del documento
      await setDoc(userDoc, userWithUID);
      console.log('Documento creado con éxito');
    } catch (error) {
      console.error('Error al escribir en Firestore:', error);
    }
  }

  async linkUsernameToUID(username: string, uid: string): Promise<void> {
    try {
      const usernameDoc = doc(this._firestore, `usernames/${username}`);
      await setDoc(usernameDoc, { uid });
      console.log('Nombre de usuario vinculado con éxito');
    } catch (error) {
      console.error('Error al vincular el nombre de usuario:', error);
      throw error; // Para manejar el error en el componente
    }
  }

}

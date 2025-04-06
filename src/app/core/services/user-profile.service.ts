// src/app/core/services/user-profile.service.ts
import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, map, of, switchMap } from 'rxjs';

export interface UserProfileData {
  uid: string;
  nombre?: string;
  apellido?: string;
  nombreUsuario?: string;
  profileImageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  // Cache de perfiles de usuario para evitar peticiones repetidas
  private userProfileCache: Map<string, UserProfileData> = new Map();
  private userProfileSubjects: Map<string, BehaviorSubject<UserProfileData | null>> = new Map();

  constructor(private firestore: Firestore) { }

  /**
   * Obtiene los datos del perfil de un usuario
   * @param userId ID del usuario
   * @returns Observable con los datos del perfil
   */
  getUserProfile(userId: string): Observable<UserProfileData | null> {
    // Si ya tenemos un BehaviorSubject para este usuario, lo devolvemos
    if (this.userProfileSubjects.has(userId)) {
      return this.userProfileSubjects.get(userId)!.asObservable();
    }

    // Crear un nuevo BehaviorSubject
    const subject = new BehaviorSubject<UserProfileData | null>(null);
    this.userProfileSubjects.set(userId, subject);

    // Si tenemos datos en caché, los emitimos inmediatamente
    if (this.userProfileCache.has(userId)) {
      subject.next(this.userProfileCache.get(userId)!);
    }

    // Obtener datos frescos de Firestore
    this.fetchUserProfileFromFirestore(userId).then(userData => {
      if (userData) {
        // Actualizar caché y emitir nuevos datos
        this.userProfileCache.set(userId, userData);
        subject.next(userData);
      }
    }).catch(error => {
      console.error(`Error al obtener datos del usuario ${userId}:`, error);
    });

    return subject.asObservable();
  }

  /**
   * Obtiene los datos del perfil directamente de Firestore
   * @param userId ID del usuario
   * @returns Promise con los datos del perfil
   */
  async fetchUserProfileFromFirestore(userId: string): Promise<UserProfileData | null> {
    try {
      // Intentar primero en la colección general de usuarios
      const userDoc = await getDoc(doc(this.firestore, 'usuarios', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          uid: userId,
          nombre: userData['nombre'],
          apellido: userData['apellido'],
          nombreUsuario: userData['nombreUsuario'],
          profileImageUrl: userData['profileImageUrl']
        };
      }
      
      // Si no se encuentra, intentar buscar en todas las colecciones de carreras
      const carreras = ['IEME', 'MCM', 'EMA', 'Mecatronica', 'Informatica', 'Ciencias'];
      
      for (const carrera of carreras) {
        // Normalizar el nombre de la colección (como en tu código original)
        const collectionName = carrera
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "");
          
        const userCarreraDoc = await getDoc(doc(this.firestore, collectionName, userId));
        
        if (userCarreraDoc.exists()) {
          const userData = userCarreraDoc.data();
          return {
            uid: userId,
            nombre: userData['nombre'],
            apellido: userData['apellido'],
            nombreUsuario: userData['nombreUsuario'],
            profileImageUrl: userData['profileImageUrl']
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error al buscar perfil de usuario:', error);
      return null;
    }
  }

  /**
   * Obtiene la URL de la imagen de perfil
   * @param userId ID del usuario
   * @returns Observable con la URL de la imagen o null
   */
  getProfileImageUrl(userId: string): Observable<string | null> {
    return this.getUserProfile(userId).pipe(
      map(profile => profile?.profileImageUrl || null)
    );
  }

  /**
   * Obtiene el nombre de usuario para mostrar
   * @param userId ID del usuario
   * @returns Observable con el nombre de usuario
   */
  getDisplayName(userId: string): Observable<string> {
    return this.getUserProfile(userId).pipe(
      map(profile => {
        if (!profile) return 'Usuario';
        return profile.nombreUsuario || 
               `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 
               'Usuario';
      })
    );
  }

  /**
   * Limpia la caché para un usuario específico o todos si no se especifica
   * @param userId ID del usuario (opcional)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.userProfileCache.delete(userId);
      // Si hay un subject, emitimos null
      if (this.userProfileSubjects.has(userId)) {
        this.userProfileSubjects.get(userId)!.next(null);
      }
    } else {
      this.userProfileCache.clear();
      // Reiniciar todos los subjects
      this.userProfileSubjects.forEach(subject => subject.next(null));
    }
  }

  /**
   * Busca usuarios por nombre de usuario
   * @param searchTerm Término de búsqueda
   * @param limit Límite de resultados (opcional, por defecto 10)
   * @returns Promise con los resultados
   */
  async searchUsers(searchTerm: string, limit: number = 10): Promise<UserProfileData[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    try {
      // Normalizar el término de búsqueda
      const normalizedTerm = searchTerm.toLowerCase().trim();
      
      // Búsqueda en la colección general de usuarios
      const usersCollection = collection(this.firestore, 'usuarios');
      
      // No podemos hacer búsquedas de texto completo en Firestore fácilmente,
      // así que usamos startAt/endAt para búsquedas de prefijo
      const q = query(
        usersCollection,
        where('nombreUsuario', '>=', normalizedTerm),
        where('nombreUsuario', '<=', normalizedTerm + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      
      const results: UserProfileData[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        results.push({
          uid: doc.id,
          nombre: data['nombre'],
          apellido: data['apellido'],
          nombreUsuario: data['nombreUsuario'],
          profileImageUrl: data['profileImageUrl']
        });
      });
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
      return [];
    }
  }
}
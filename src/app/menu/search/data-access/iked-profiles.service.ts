import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, arrayUnion, arrayRemove } from '@angular/fire/firestore';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LikedProfilesService {
    private readonly LIKED_PROFILES_KEY = 'liked_profiles';
    private likedProfiles$ = new BehaviorSubject<string[]>([]);

    constructor(
        private auth: Auth,
        private firestore: Firestore
    ) {
        this.loadLikedProfiles();
    }

    /**
     * Obtiene el observable con la lista de perfiles con like
     */
    getLikedProfiles(): Observable<string[]> {
        return this.likedProfiles$.asObservable();
    }

    /**
     * Da like a un perfil para el usuario actual
     * @param profileId ID del perfil al que se da like
     */
    async likeProfile(profileId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            // 1. Agregar a Firebase
            const userLikesRef = doc(this.firestore, `userLikes/${currentUser.uid}`);
            await setDoc(userLikesRef, {
                likedProfiles: arrayUnion(profileId),
                lastUpdated: new Date()
            }, { merge: true });

            // 2. Actualizar estado local
            const currentLikes = this.likedProfiles$.value || [];
            if (!currentLikes.includes(profileId)) {
                const updatedLikes = [...currentLikes, profileId];
                this.likedProfiles$.next(updatedLikes);

                // 3. Guardar en almacenamiento local
                await this.saveToLocalStorage(updatedLikes);
            }

            console.log(`Perfil ${profileId} marcado como favorito correctamente`);
        } catch (error) {
            console.error('Error al dar like al perfil:', error);
            throw new Error('No se pudo marcar el perfil como favorito');
        }
    }

    /**
     * Quita el like a un perfil
     * @param profileId ID del perfil a quitar el like
     */
    async unlikeProfile(profileId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            // 1. Eliminar de Firebase
            const userLikesRef = doc(this.firestore, `userLikes/${currentUser.uid}`);
            await setDoc(userLikesRef, {
                likedProfiles: arrayRemove(profileId),
                lastUpdated: new Date()
            }, { merge: true });

            // 2. Actualizar estado local
            const currentLikes = this.likedProfiles$.value || [];
            const updatedLikes = currentLikes.filter(id => id !== profileId);
            this.likedProfiles$.next(updatedLikes);

            // 3. Guardar en almacenamiento local
            await this.saveToLocalStorage(updatedLikes);

            console.log(`Perfil ${profileId} eliminado de favoritos correctamente`);
        } catch (error) {
            console.error('Error al quitar el like del perfil:', error);
            throw new Error('No se pudo quitar el perfil de favoritos');
        }
    }

    /**
     * Verifica si un perfil tiene like
     * @param profileId ID del perfil a verificar
     * @returns true si el perfil tiene like, false en caso contrario
     */
    isProfileLiked(profileId: string): boolean {
        const likedProfiles = this.likedProfiles$.value || [];
        return likedProfiles.includes(profileId);
    }

    /**
     * Carga los perfiles con like desde Firebase y el almacenamiento local
     */
    private async loadLikedProfiles(): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            // Primero intentar cargar desde el almacenamiento local para respuesta rápida
            const localLikes = await this.loadFromLocalStorage();

            if (localLikes.length > 0) {
                this.likedProfiles$.next(localLikes);
            }

            // Luego cargar desde Firebase para tener datos actualizados
            const userLikesRef = doc(this.firestore, `userLikes/${currentUser.uid}`);
            const docSnap = await getDoc(userLikesRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const firebaseLikes = data['likedProfiles'] || [];

                // Actualizar el estado y el almacenamiento local solo si hay cambios
                if (JSON.stringify(firebaseLikes) !== JSON.stringify(localLikes)) {
                    this.likedProfiles$.next(firebaseLikes);
                    await this.saveToLocalStorage(firebaseLikes);
                }
            } else if (localLikes.length > 0) {
                // Si hay likes locales pero no en Firebase, sincronizar hacia arriba
                await setDoc(userLikesRef, {
                    likedProfiles: localLikes,
                    lastUpdated: new Date()
                });
            }
        } catch (error) {
            console.error('Error al cargar perfiles con like:', error);
        }
    }

    /**
     * Guarda la lista de perfiles con like en el almacenamiento local
     */
    private async saveToLocalStorage(likedProfiles: string[]): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            const key = `${this.LIKED_PROFILES_KEY}_${currentUser.uid}`;
            await Preferences.set({
                key,
                value: JSON.stringify(likedProfiles)
            });
        } catch (error) {
            console.error('Error guardando perfiles con like en almacenamiento local:', error);
        }
    }

    /**
     * Carga la lista de perfiles con like desde el almacenamiento local
     */
    private async loadFromLocalStorage(): Promise<string[]> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return [];

        try {
            const key = `${this.LIKED_PROFILES_KEY}_${currentUser.uid}`;
            const { value } = await Preferences.get({ key });

            if (!value) return [];

            return JSON.parse(value) as string[];
        } catch (error) {
            console.error('Error cargando perfiles con like desde almacenamiento local:', error);
            return [];
        }
    }

    /**
     * Limpia los perfiles con like para el usuario actual (útil al cerrar sesión)
     */
    async clearLikedProfiles(): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            const key = `${this.LIKED_PROFILES_KEY}_${currentUser.uid}`;
            await Preferences.remove({ key });
            this.likedProfiles$.next([]);
        } catch (error) {
            console.error('Error al limpiar perfiles con like:', error);
        }
    }
}
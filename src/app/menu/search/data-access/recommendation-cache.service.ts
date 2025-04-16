import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';

interface RecommendationCache {
    allPotentialMatches: any[];
    lastUpdated: number; // timestamp
    currentUserId: string;
    lastQuery?: {
        carrerasBuscadas: string[];
        anioLectivo: string;
    };
}

@Injectable({
    providedIn: 'root'
})
export class RecommendationCacheService {
    private readonly RECOMMENDATIONS_KEY = 'cached_recommendations';
    private cachedRecommendations$ = new BehaviorSubject<any[]>([]);

    // Tiempo de caducidad del caché en milisegundos (por defecto: 1 hora)
    private readonly CACHE_EXPIRY_TIME = 60 * 60 * 1000;

    constructor(private auth: Auth) { }

    /**
     * Obtiene recomendaciones almacenadas en caché
     */
    getCachedRecommendations(): Observable<any[]> {
        return this.cachedRecommendations$.asObservable();
    }

    /**
     * Guarda recomendaciones en el caché
     * @param recommendations Lista de recomendaciones a guardar
     * @param queryParams Parámetros de la consulta que generó estas recomendaciones
     */
    async cacheRecommendations(recommendations: any[], queryParams?: {
        carrerasBuscadas: string[];
        anioLectivo: string;
    }): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            const cache: RecommendationCache = {
                allPotentialMatches: recommendations,
                lastUpdated: Date.now(),
                currentUserId: currentUser.uid,
                lastQuery: queryParams
            };

            await this.saveToLocalStorage(cache);
            this.cachedRecommendations$.next(recommendations);

            console.log(`Guardadas ${recommendations.length} recomendaciones en caché`);
        } catch (error) {
            console.error('Error al guardar recomendaciones en caché:', error);
        }
    }

    /**
     * Carga recomendaciones desde el caché si están disponibles y no han expirado
     * @param queryParams Parámetros de la consulta actual para verificar si ha cambiado
     * @returns true si se cargaron recomendaciones válidas, false en caso contrario
     */
    async loadFromCache(queryParams?: {
        carrerasBuscadas: string[];
        anioLectivo: string;
    }): Promise<boolean> {
        console.log('🔍 RecommendationCacheService.loadFromCache - iniciando...');
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.log('⚠️ No hay usuario autenticado');
            return false;
        }
    
        try {
            console.log(`🔍 Intentando cargar caché para usuario: ${currentUser.uid}`);
            const cache = await this.loadFromLocalStorage();
            
            if (!cache) {
                console.log('⚠️ No se encontró caché en el almacenamiento local');
                return false;
            }
            
            console.log('🔍 Caché encontrado, verificando validez...');
            console.log(`🔍 Timestamp del caché: ${new Date(cache.lastUpdated).toISOString()}`);
            console.log(`🔍 Cantidad de recomendaciones en caché: ${cache.allPotentialMatches?.length || 0}`);
            
            // Verificar si el caché es válido
            if (!this.isValidCache(cache, queryParams)) {
                console.log('⚠️ Caché encontrado pero inválido');
                return false;
            }
    
            // Caché válido
            console.log('✅ Caché válido, actualizando estado local');
            this.cachedRecommendations$.next(cache.allPotentialMatches);
            console.log(`✅ Cargadas ${cache.allPotentialMatches.length} recomendaciones desde caché`);
            return true;
        } catch (error) {
            console.error('❌ Error al cargar recomendaciones desde caché:', error);
            return false;
        }
    }

    /**
     * Verifica si el caché es válido para ser utilizado
     */
    private isValidCache(cache: RecommendationCache | null, currentQuery?: {
        carrerasBuscadas: string[];
        anioLectivo: string;
    }): boolean {
        if (!cache) {
            console.log('⚠️ Caché es null');
            return false;
        }
    
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.log('⚠️ No hay usuario autenticado');
            return false;
        }
    
        // Verificar si el caché pertenece al usuario actual
        if (cache.currentUserId !== currentUser.uid) {
            console.log(`⚠️ Caché pertenece a otro usuario: ${cache.currentUserId} vs ${currentUser.uid}`);
            return false;
        }
    
        // Verificar si el caché ha expirado
        const now = Date.now();
        const age = now - cache.lastUpdated;
        const expiryInMinutes = this.CACHE_EXPIRY_TIME / (60 * 1000);
        if (age > this.CACHE_EXPIRY_TIME) {
            console.log(`⚠️ Caché ha expirado: ${Math.round(age / (60 * 1000))} minutos de antigüedad (límite: ${expiryInMinutes} minutos)`);
            return false;
        } else {
            console.log(`✅ Caché vigente: ${Math.round(age / (60 * 1000))} minutos de antigüedad (límite: ${expiryInMinutes} minutos)`);
        }
    
        // Verificar si los parámetros de búsqueda han cambiado
        if (currentQuery && cache.lastQuery) {
            console.log('🔍 Verificando parámetros de búsqueda...');
            console.log(`🔍 Actual: ${JSON.stringify(currentQuery)}`);
            console.log(`🔍 Caché: ${JSON.stringify(cache.lastQuery)}`);
            
            const sameCarreras = this.areArraysEqual(
                currentQuery.carrerasBuscadas,
                cache.lastQuery.carrerasBuscadas
            );
    
            if (!sameCarreras) {
                console.log('⚠️ Las carreras buscadas han cambiado');
                return false;
            } else {
                console.log('✅ Mismas carreras buscadas');
            }
    
            const sameAnio = currentQuery.anioLectivo === cache.lastQuery.anioLectivo;
            if (!sameAnio) {
                console.log(`⚠️ El año lectivo ha cambiado: ${currentQuery.anioLectivo} vs ${cache.lastQuery.anioLectivo}`);
                return false;
            } else {
                console.log('✅ Mismo año lectivo');
            }
        } else if (!currentQuery) {
            console.log('⚠️ No se proporcionaron parámetros de consulta actuales');
        } else if (!cache.lastQuery) {
            console.log('⚠️ El caché no contiene parámetros de consulta');
            return false;
        }
    
        // Verificar si hay datos en el caché
        if (!cache.allPotentialMatches || cache.allPotentialMatches.length === 0) {
            console.log('⚠️ No hay recomendaciones en caché');
            return false;
        } else {
            console.log(`✅ El caché contiene ${cache.allPotentialMatches.length} recomendaciones`);
        }
    
        console.log('✅ El caché es válido');
        return true;
    }

    /**
     * Guarda recomendaciones en el almacenamiento local
     */
    private async saveToLocalStorage(cache: RecommendationCache): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            console.log('⚠️ No se puede guardar caché: no hay usuario autenticado');
            return;
        }
    
        try {
            const key = `${this.RECOMMENDATIONS_KEY}_${currentUser.uid}`;
            console.log(`🔍 Guardando caché con key: ${key}`);
            console.log(`🔍 Tamaño de datos a guardar: ${JSON.stringify(cache).length} bytes`);
            
            await Preferences.set({
                key,
                value: JSON.stringify(cache)
            });
            
            // Verificar que se guardó correctamente
            const { value } = await Preferences.get({ key });
            if (value) {
                console.log('✅ Caché guardado correctamente');
            } else {
                console.log('⚠️ El caché parece no haberse guardado correctamente');
            }
        } catch (error) {
            console.error('❌ Error guardando recomendaciones en caché:', error);
        }
    }

    /**
     * Carga recomendaciones desde el almacenamiento local
     */
    private async loadFromLocalStorage(): Promise<RecommendationCache | null> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return null;

        try {
            const key = `${this.RECOMMENDATIONS_KEY}_${currentUser.uid}`;
            const { value } = await Preferences.get({ key });

            if (!value) return null;

            return JSON.parse(value) as RecommendationCache;
        } catch (error) {
            console.error('Error cargando recomendaciones desde caché:', error);
            return null;
        }
    }

    /**
     * Limpia el caché de recomendaciones
     */
    async clearCache(): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            const key = `${this.RECOMMENDATIONS_KEY}_${currentUser.uid}`;
            await Preferences.remove({ key });
            this.cachedRecommendations$.next([]);
            console.log('Caché de recomendaciones limpiado');
        } catch (error) {
            console.error('Error al limpiar caché de recomendaciones:', error);
        }
    }

    /**
     * Compara si dos arrays tienen los mismos elementos
     */
    private areArraysEqual(arr1: any[], arr2: any[]): boolean {
        if (arr1.length !== arr2.length) return false;

        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();

        return sorted1.every((val, i) => val === sorted2[i]);
    }
}
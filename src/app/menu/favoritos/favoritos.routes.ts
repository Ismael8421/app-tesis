import { Routes } from "@angular/router";

export default [
    {
        path: '',
        loadComponent: () => import('./favoritos.component').then(m => m.FavoritosComponent)
    }
] as Routes;
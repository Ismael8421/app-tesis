import { Routes } from "@angular/router";

export default [
    {
        path: '',
        loadComponent: () => import('./menu/menu.component').then(m => m.MenuComponent),
    }
] as Routes;

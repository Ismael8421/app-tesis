import { Routes } from "@angular/router";

export default [
    {
        path: '',
        loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
    }
] as Routes;

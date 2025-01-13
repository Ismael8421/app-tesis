import { Routes } from "@angular/router";

export default [
    {
        path: '',
        loadComponent: () => import('./menu/menu.component').then(m => m.MenuComponent),
        children: [
            {
                path: '',
                redirectTo: 'recomendados',
                pathMatch: 'full'
            },
            {
                path: 'mensajes',
                loadChildren: () => import('./chats/chats.routes')
            },
            {
                path: 'recomendados',
                loadComponent: () => import('./search/search.component').then(m => m.SearchComponent)
            },
            {
                path: 'configuraciones',
                loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
            }
        ]
    }
] as Routes;
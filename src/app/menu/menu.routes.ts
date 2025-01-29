import { Routes } from "@angular/router";

export default [
    // La ruta del mensaje ahora está al mismo nivel que el menú
    {
        path: 'mensajes/:id',
        loadComponent: () => import('./chats/message/message.component')
            .then(m => m.MessageComponent)
    },
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
                path: 'chats',
                loadChildren: () => import('./chats/chats.routes')
            },
            {
                path: 'recomendados',
                loadComponent: () => import('./search/search.component').then(m => m.SearchComponent)
            },
            {
                path: 'configuraciones',
                loadComponent: () => import('./configs/settings/settings.component').then(m => m.SettingsComponent)
            }
        ]
    },
    {
        path: 'perfil',
        loadComponent: () => import('./configs/profile/profile.component').then(m => m.ProfileComponent)
    },
    {
        path: 'chagePwsEmail',
        loadComponent: () => import('./configs/change-pws-email/change-pws-email.component').then(m => m.default)
    }
] as Routes;
import { Routes } from '@angular/router';
import { privateGuard, publicGuard } from './account/core/auth.guard';

export const routes: Routes = [
    {
        canActivateChild: [publicGuard()],
        path: 'auth',
        loadChildren: () => import('./account/auth/features/auth.routes'),
    },
    {
        canActivateChild: [privateGuard()],
        path: 'tasks',
        loadChildren: () => import('./menu/features/menu.routes'),
    },
    {
        path: '**',
        redirectTo: './tasks'
    },
];

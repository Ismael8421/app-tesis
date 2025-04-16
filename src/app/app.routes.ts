import { Routes } from '@angular/router';
import { privateGuard, publicGuard } from './account/core/auth.guard';
import { profileCompleteGuard } from './register/guards/profile-complete.guard';
import { SplashScreenComponent } from './splash-screen/splash-screen.component';

export const routes: Routes = [
    {
        path: '',
        component: SplashScreenComponent,
        pathMatch: 'full'
    },
    {
        canActivateChild: [publicGuard()],
        path: 'auth',
        loadChildren: () => import('./account/auth/features/auth.routes'),
    },
    {
        // Usar ambos guards: primero verificar autenticación y luego perfil completo
        canActivateChild: [privateGuard(), profileCompleteGuard()],
        path: 'menu',
        loadComponent:() => import('./account/shared/ui/layout.component'),
        loadChildren: () => import('./menu/menu.routes'),
    },
    {
        // El registro solo requiere autenticación
        canActivateChild: [privateGuard()],
        path: 'register',
        loadChildren: () => import('./register/register.routes'),
    },
    {
        path: '**',
        redirectTo: '/auth/sign-in',
    },
];
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage) },
      { path: 'trades', loadComponent: () => import('./pages/trades').then((m) => m.TradesPage) },
      { path: 'screener', loadComponent: () => import('./pages/screener').then((m) => m.ScreenerPage) },
      { path: 'alerts', loadComponent: () => import('./pages/alerts').then((m) => m.AlertsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

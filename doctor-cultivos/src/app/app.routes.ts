import { Routes } from '@angular/router';
import { Home } from './home/home';
import { DiagnosticoComponent } from './components/diagnostico/diagnostico.component';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'diagnostico', component: DiagnosticoComponent },
  { path: '**', redirectTo: '' },
];

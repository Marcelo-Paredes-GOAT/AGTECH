import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { DiagnosticoResponse } from './diagnostico.interface';

@Injectable({ providedIn: 'root' })
export class DiagnosticoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'https://agetch.onrender.com/diagnosticar';

  diagnosticar(file: File, lat: number, lon: number): Observable<DiagnosticoResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lat', lat.toString());
    formData.append('lon', lon.toString());

    return this.http.post<DiagnosticoResponse>(this.API_URL, formData).pipe(
      timeout(30000),
      catchError((err: unknown) => this.handleError(err))
    );
  }

  private handleError(err: unknown): Observable<never> {
    if (err instanceof TimeoutError) {
      return throwError(() => new Error('La solicitud tardó demasiado. Verifica tu conexión.'));
    }

    if (err instanceof HttpErrorResponse) {
      switch (err.status) {
        case 0:
          return throwError(() => new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.'));
        case 400:
          return throwError(() => new Error('Datos inválidos. Verifica la imagen seleccionada.'));
        case 404:
          return throwError(() => new Error('El servicio de diagnóstico no está disponible en este momento.'));
        case 422:
          return throwError(() => new Error('No se pudo procesar la imagen. Intenta con otra foto.'));
        case 500:
          return throwError(() => new Error('Error interno del servidor. Intenta más tarde.'));
        default:
          return throwError(() => new Error(`Error del servidor: ${err.status}`));
      }
    }

    return throwError(() => new Error('Ocurrió un error inesperado. Intenta de nuevo.'));
  }
}

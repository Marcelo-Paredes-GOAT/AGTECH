import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

interface ClimaResult {
  condicion: string;
  temperatura: number;
  humedad: number;
}

interface ReglaNegocio {
  alerta_riesgo: boolean;
  perdida_soles: number;
}

interface DiagnosticoResponse {
  plaga: string;
  clase_tecnica: string;
  clima: ClimaResult;
  regla_negocio: ReglaNegocio;
  tratamiento: string;
}

@Component({
  selector: 'app-diagnostico',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './diagnostico.component.html',
  styles: [
    `
    :host {
      display: block;
      min-height: 100dvh;
      background: linear-gradient(160deg, #021a12 0%, #064e3b 50%, #0c1a2e 100%);
      font-family: 'Inter', sans-serif;
      color: #ffffff;
    }
    .diag-shell {
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      padding: 24px 16px 40px;
      min-height: 100dvh;
    }
    .diag-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .diag-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 4px;
    }
    .diag-back {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.07);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1);
      color: #cbd5e1;
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      flex-shrink: 0;
    }
    .diag-back:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }
    .diag-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
    }
    .diag-subtitle {
      font-size: 0.78rem;
      color: #94a3b8;
      margin: 2px 0 0;
    }
    .diag-card {
      background: rgba(255,255,255,0.07);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .upload-card {
      cursor: pointer;
      text-align: center;
      padding: 0;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px dashed rgba(52,211,153,0.25);
    }
    .upload-card:hover {
      border-color: rgba(52,211,153,0.5);
      background: rgba(255,255,255,0.1);
    }
    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 24px;
      color: #34d399;
    }
    .upload-text {
      font-size: 0.875rem;
      color: #94a3b8;
      margin: 0;
      max-width: 220px;
    }
    .preview-wrapper {
      position: relative;
      width: 100%;
      height: 220px;
    }
    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
      font-size: 0.85rem;
      font-weight: 500;
      color: #fff;
    }
    .preview-wrapper:hover .preview-overlay {
      opacity: 1;
    }
    .gps-card {
      padding: 14px 20px;
    }
    .gps-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .gps-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #64748b;
      transition: background 0.3s;
    }
    .gps-dot.gps-active {
      background: #34d399;
      box-shadow: 0 0 8px rgba(52,211,153,0.5);
    }
    .gps-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
    }
    .gps-coords {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .coord {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 0.9rem;
      font-weight: 600;
      color: #e2e8f0;
    }
    .coord-muted {
      color: #64748b;
      font-weight: 400;
      font-size: 0.8rem;
    }
    .coord-sep {
      color: #475569;
    }
    .diag-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 16px 24px;
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      color: #064e3b;
      background: linear-gradient(135deg, #34d399, #6ee7b7);
      border: none;
      border-radius: 99px;
      box-shadow: 0 4px 20px rgba(52,211,153,0.25);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      touch-action: manipulation;
    }
    .diag-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(52,211,153,0.35);
    }
    .diag-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    .diag-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .diag-btn-loading {
      background: linear-gradient(135deg, #059669, #34d399);
      color: #fff;
    }
    .btn-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .result-card {
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: fadeInUp 0.5s ease-out;
    }
    .result-image-section {
      text-align: center;
    }
    .result-img {
      width: 100%;
      max-height: 240px;
      object-fit: contain;
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
    }
    .result-section {
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .result-section:last-of-type {
      border-bottom: none;
      padding-bottom: 0;
    }
    .result-badge {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #34d399;
      background: rgba(52,211,153,0.1);
      padding: 3px 10px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .result-plaga {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 6px;
      line-height: 1.3;
    }
    .result-clase {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0;
    }
    .label {
      color: #64748b;
    }
    .treatment-box {
      font-size: 0.85rem;
      color: #cbd5e1;
      line-height: 1.6;
      background: rgba(0,0,0,0.2);
      padding: 14px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .weather-grid {
      display: flex;
      gap: 10px;
    }
    .weather-item {
      flex: 1;
      text-align: center;
      padding: 10px 6px;
      background: rgba(0,0,0,0.15);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .weather-val {
      display: block;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      color: #e2e8f0;
    }
    .weather-lbl {
      display: block;
      font-size: 0.65rem;
      color: #64748b;
      margin-top: 2px;
    }
    .alert-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(239,68,68,0.12);
      border: 1.5px solid rgba(239,68,68,0.35);
      animation: pulseNeon 1.5s ease-in-out infinite;
    }
    .alert-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
      line-height: 1;
    }
    .alert-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .alert-content strong {
      font-size: 0.9rem;
      font-weight: 700;
      color: #ef4444;
    }
    .alert-content span {
      font-size: 0.8rem;
      color: #fca5a5;
    }
    @keyframes pulseNeon {
      0%, 100% {
        box-shadow: 0 0 20px rgba(239,68,68,0.2);
        border-color: rgba(239,68,68,0.35);
      }
      50% {
        box-shadow: 0 0 35px rgba(239,68,68,0.4);
        border-color: rgba(239,68,68,0.6);
      }
    }
    .error-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 12px;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.25);
      font-size: 0.85rem;
      color: #fca5a5;
    }
    .error-retry {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      color: #cbd5e1;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 0.75rem;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .error-retry:hover {
      background: rgba(255,255,255,0.15);
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 360px) {
      .diag-shell { padding: 16px 12px 32px; }
      .weather-grid { flex-direction: column; }
      .weather-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 14px;
      }
      .weather-val { font-size: 0.95rem; }
      .weather-lbl { margin-top: 0; }
    }
    @supports (padding-top: env(safe-area-inset-top)) {
      .diag-shell { padding-top: calc(24px + env(safe-area-inset-top)); }
    }
    `,
  ],
})
export class DiagnosticoComponent implements OnInit, OnDestroy {
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly latitude = signal<number>(0);
  readonly longitude = signal<number>(0);
  readonly gpsReady = signal(false);
  readonly loading = signal(false);
  readonly resultado = signal<DiagnosticoResponse | null>(null);
  readonly error = signal<string>('');

  private readonly API_URL = 'https://agetch.onrender.com/diagnosticar';
  private gpsWatchId: number | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.obtenerGeolocalizacion();
  }

  ngOnDestroy(): void {
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
    }
  }

  private obtenerGeolocalizacion(): void {
    if (!navigator.geolocation) {
      this.latitude.set(-12.0463);
      this.longitude.set(-77.0428);
      this.gpsReady.set(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.latitude.set(Number(pos.coords.latitude.toFixed(4)));
        this.longitude.set(Number(pos.coords.longitude.toFixed(4)));
        this.gpsReady.set(true);
      },
      () => {
        this.latitude.set(-12.0463);
        this.longitude.set(-77.0428);
        this.gpsReady.set(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  formatSoles(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  enviarDiagnostico(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.loading.set(true);
    this.error.set('');
    this.resultado.set(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lat', this.latitude().toString());
    formData.append('lon', this.longitude().toString());

    this.http.post<DiagnosticoResponse>(this.API_URL, formData).subscribe({
      next: (res) => {
        this.resultado.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error en diagnóstico:', err);
        this.error.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. Verifica tu conexión.'
            : `Error del servidor: ${err.status}`
        );
        this.loading.set(false);
      },
    });
  }
}

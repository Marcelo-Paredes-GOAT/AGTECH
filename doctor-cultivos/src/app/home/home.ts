import { Component, signal, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WeatherService } from '../weather.service';
import { WeatherData } from '../weather.interface';
import { LocationService } from '../location.service';
import { DiagnosticoService } from '../diagnostico.service';
import { DiagnosticoResponse } from '../diagnostico.interface';
import { GroqService, GroqContext } from '../groq.service';
import { environment } from '../../environments/environment';

interface TratamientoSection {
  icon: string;
  titulo: string;
  contenido: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly weatherSvc = inject(WeatherService);
  protected readonly locationSvc = inject(LocationService);
  private readonly diagnosticoSvc = inject(DiagnosticoService);
  private readonly groqSvc = inject(GroqService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  readonly state = signal<'upload' | 'loading' | 'generando' | 'results' | 'error'>('upload');
  readonly resultData = signal<DiagnosticoResponse | null>(null);
  readonly isDragOver = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly usandoGroq = signal(false);
  readonly tratamientoSections = signal<TratamientoSection[]>([]);
  readonly groqPendiente = signal(false);
  readonly cargandoEstimacion = signal(false);
  readonly estimacionTipo = signal<'plantas' | 'area' | null>(null);
  readonly cantidadPlantas = signal<number | null>(null);
  readonly areaHectareas = signal<number | null>(null);
  readonly precioKg = signal<number | null>(null);

  readonly climateState = signal<'loading' | 'loaded' | 'error'>('loading');
  readonly weatherData = signal<WeatherData | null>(null);
  readonly climateError = signal('');

  readonly parseNum = (v: string | null | undefined): number | null =>
    v ? Number(v) : null;

  readonly horaActual = new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  readonly fechaActual = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  ngOnInit(): void {
    this.obtenerClima();
  }

  private obtenerClima(): void {
    if (this.locationSvc.gpsReady()) {
      this.fetchWeather(this.locationSvc.latitude(), this.locationSvc.longitude());
    } else {
      this.climateState.set('error');
      this.climateError.set('Permiso de ubicación no concedido');
    }
  }

  private fetchWeather(lat: number, lon: number): void {
    this.weatherSvc.getWeather(lat, lon).subscribe({
      next: (data) => {
        this.weatherData.set(data);
        this.climateState.set('loaded');
      },
      error: () => {
        this.climateState.set('error');
        this.climateError.set('Error al consultar clima');
      },
    });
  }

  triggerFileInput(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) return;

    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  analyze(): void {
    const file = this.selectedFile();
    if (!file) return;

    if (!this.locationSvc.gpsReady()) {
      this.errorMessage.set('Primero debes permitir la ubicación para usar el diagnóstico.');
      this.state.set('error');
      return;
    }

    this.state.set('loading');
    this.errorMessage.set('');
    this.resultData.set(null);
    this.usandoGroq.set(false);
    this.tratamientoSections.set([]);
    this.groqPendiente.set(false);
    this.cargandoEstimacion.set(false);
    this.estimacionTipo.set(null);
    this.cantidadPlantas.set(null);
    this.areaHectareas.set(null);
    this.precioKg.set(null);

    const lat = this.locationSvc.latitude();
    const lon = this.locationSvc.longitude();

    this.diagnosticoSvc.diagnosticar(file, lat, lon).subscribe({
      next: (res) => {
        this.procesarResultado(res);
      },
      error: (err: Error) => {
        this.errorMessage.set(err.message);
        this.state.set('error');
      },
    });
  }

  private procesarResultado(res: DiagnosticoResponse): void {
    const necesitaIA = res.tratamiento.toLowerCase().includes('tratamiento específico');

    if (!necesitaIA) {
      this.resultData.set(res);
      this.state.set('results');
      return;
    }

    this.resultData.set(res);
    this.groqPendiente.set(true);
    this.state.set('results');
  }

  private construirContexto(): GroqContext {
    const w = this.weatherData();
    const res = this.resultData();
    if (!res) throw new Error('Sin datos de diagnóstico');

    return {
      plaga: res.plaga,
      clase_tecnica: res.clase_tecnica,
      condicion: w?.weatherDescription || res.clima.condicion,
      humedad: w?.humidity ?? res.clima.humedad,
      temperatura: w?.currentTemp || 0,
      windSpeed: w?.windSpeed,
      alerta: res.regla_negocio.alerta_riesgo,
      perdida: res.regla_negocio.perdida_soles,
      cantidadPlantas: this.cantidadPlantas() ?? undefined,
      areaHectareas: this.areaHectareas() ?? undefined,
      precioKg: this.precioKg() ?? undefined,
    };
  }

  enviarEstimacion(): void {
    this.cargandoEstimacion.set(true);
    this.groqPendiente.set(false);

    const contexto = this.construirContexto();

    this.groqSvc.generarTratamiento(contexto, environment.groqApiKey).subscribe({
      next: (texto) => {
        const res = this.resultData();
        if (!res) return;
        res.tratamiento = texto || res.tratamiento;
        this.tratamientoSections.set(this.parsearSecciones(texto));
        this.usandoGroq.set(true);
        this.cargandoEstimacion.set(false);
      },
      error: () => {
        console.error('[Home] Groq no respondió, se conserva el tratamiento genérico');
        this.cargandoEstimacion.set(false);
      },
    });
  }

  omitirEstimacion(): void {
    this.cantidadPlantas.set(null);
    this.areaHectareas.set(null);
    this.precioKg.set(null);
    this.enviarEstimacion();
  }

  private parsearSecciones(texto: string): TratamientoSection[] {
    const partes = texto.split(/(?=^## )/m);
    return partes
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => {
        const lineas = p.split('\n');
        const encabezado = lineas[0].replace(/^##\s*/, '');
        const contenido = lineas.slice(1).join('\n').trim();
        const match = encabezado.match(/^(\S+)\s+(.*)/);
        const icono = match?.[1] || '';
        const titulo = match?.[2] || encabezado;
        return { icon: icono, titulo, contenido };
      });
  }

  formatearContenido(texto: string): SafeHtml {
    const html = texto
      .replace(/^###\s+(.*)$/gm, '<strong>$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(`<p>${html}</p>`);
  }

  getCardType(icon: string): string {
    const map: Record<string, string> = {
      '🌿': 'descripcion',
      '🌦️': 'clima',
      '⏳': 'evolucion',
      '✅': 'acciones',
      '💊': 'tratamiento',
      '🛡️': 'prevencion',
      '📊': 'impacto',
      '⚠️': 'advertencias',
    };
    return map[icon] || 'default';
  }

  formatSoles(amount: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  resetApp(): void {
    this.state.set('upload');
    this.resultData.set(null);
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.errorMessage.set('');
    this.usandoGroq.set(false);
    this.tratamientoSections.set([]);
    this.groqPendiente.set(false);
    this.cargandoEstimacion.set(false);
    this.estimacionTipo.set(null);
    this.cantidadPlantas.set(null);
    this.areaHectareas.set(null);
    this.precioKg.set(null);
  }
}

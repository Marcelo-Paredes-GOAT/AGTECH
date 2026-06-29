import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WeatherService } from '../weather.service';
import { WeatherData } from '../weather.interface';
import { LocationService } from '../location.service';
import { map, switchMap } from 'rxjs';

type WelcomeState =
  | 'initial'
  | 'requesting'
  | 'loading'
  | 'loaded'
  | 'denied'
  | 'unsupported'
  | 'error';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly weatherSvc = inject(WeatherService);
  private readonly locationSvc = inject(LocationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly done = output<void>();

  readonly state = signal<WelcomeState>('initial');
  readonly weatherData = signal<WeatherData | null>(null);
  readonly errorMessage = signal('');

  private locationDone = false;

  requestLocation(): void {
    if (!navigator.geolocation) {
      this.state.set('unsupported');
      return;
    }

    this.locationDone = false;
    this.state.set('requesting');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (this.locationDone) return;
        this.locationDone = true;

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        this.locationSvc.setLocation(lat, lon);
        this.state.set('loading');
        this.fetchWeatherAndCity(lat, lon);
      },
      (err) => {
        if (this.locationDone) return;
        this.locationDone = true;

        if (err.code === err.PERMISSION_DENIED) {
          this.state.set('denied');
        } else if (err.code === err.TIMEOUT) {
          this.state.set('error');
          this.errorMessage.set(
            'La solicitud de ubicación tardó demasiado. Intenta de nuevo.'
          );
        } else {
          this.state.set('error');
          this.errorMessage.set(
            'No se pudo obtener tu ubicación. Intenta de nuevo.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  private fetchWeatherAndCity(lat: number, lon: number): void {
    this.weatherSvc
      .reverseGeocode(lat, lon)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((city) =>
          this.weatherSvc.getWeather(lat, lon).pipe(
            map((data) => {
              data.city = city;
              return data;
            })
          )
        )
      )
      .subscribe({
        next: (data) => {
          this.weatherData.set(data);
          this.state.set('loaded');
        },
        error: () => {
          this.state.set('error');
          this.errorMessage.set(
            'No se pudo consultar el clima. Verifica tu conexión.'
          );
        },
      });
  }

  retry(): void {
    this.locationDone = false;
    this.state.set('initial');
    this.errorMessage.set('');
    this.weatherData.set(null);
  }

  continueToApp(): void {
    this.done.emit();
  }
}

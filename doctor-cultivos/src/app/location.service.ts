import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly latitude = signal<number>(0);
  readonly longitude = signal<number>(0);
  readonly gpsReady = signal(false);

  setLocation(lat: number, lon: number): void {
    this.latitude.set(Number(lat.toFixed(4)));
    this.longitude.set(Number(lon.toFixed(4)));
    this.gpsReady.set(true);
  }
}

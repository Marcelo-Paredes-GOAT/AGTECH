import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import {
  OpenMeteoResponse,
  NominatimResponse,
  WeatherData,
  getWeatherDescription,
  getDayName,
} from './weather.interface';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);

  private readonly OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
  private readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

  getWeather(lat: number, lon: number): Observable<WeatherData> {
    return forkJoin({
      meteo: this.http.get<OpenMeteoResponse>(this.OPEN_METEO_URL, {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
          daily: 'temperature_2m_max,temperature_2m_min,weather_code',
          timezone: 'auto',
          forecast_days: '7',
        },
      }),
      ciudad: this.reverseGeocode(lat, lon),
    }).pipe(
      map(({ meteo, ciudad }) => {
        const data = this.mapToWeatherData(meteo);
        data.city = ciudad;
        return data;
      }),
      catchError(() =>
        of({
          city: 'Ubicación actual',
          currentTemp: 0,
          feelsLike: 0,
          weatherCode: 0,
          weatherDescription: '—',
          dailyMax: 0,
          dailyMin: 0,
          humidity: undefined,
          windSpeed: undefined,
          forecast: [],
        })
      )
    );
  }

  reverseGeocode(lat: number, lon: number): Observable<string> {
    return this.http
      .get<NominatimResponse>(this.NOMINATIM_URL, {
        params: {
          lat,
          lon,
          format: 'json',
          'accept-language': 'es',
          zoom: '10',
        },
      })
      .pipe(
        map((res) => {
          const addr = res.address;
          return (
            addr?.city ||
            addr?.town ||
            addr?.village ||
            addr?.state ||
            res.display_name?.split(',')[0] ||
            'Ubicación actual'
          );
        }),
        catchError(() => of('Ubicación actual'))
      );
  }

  private mapToWeatherData(res: OpenMeteoResponse): WeatherData {
    const daily = res.daily;
    const forecast = daily.time.map((t, i) => ({
      date: t,
      dayName: getDayName(t),
      max: daily.temperature_2m_max[i],
      min: daily.temperature_2m_min[i],
      weatherCode: daily.weather_code[i],
      weatherDescription: getWeatherDescription(daily.weather_code[i]),
    }));

    return {
      city: 'Ubicación actual',
      currentTemp: Math.round(res.current.temperature_2m),
      feelsLike: Math.round(res.current.apparent_temperature),
      weatherCode: res.current.weather_code,
      weatherDescription: getWeatherDescription(res.current.weather_code),
      humidity: res.current.relative_humidity_2m ?? undefined,
      windSpeed: res.current.wind_speed_10m ? Math.round(res.current.wind_speed_10m) : undefined,
      dailyMax: Math.round(daily.temperature_2m_max[0]),
      dailyMin: Math.round(daily.temperature_2m_min[0]),
      forecast,
    };
  }
}

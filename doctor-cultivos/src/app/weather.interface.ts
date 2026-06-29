export interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m?: number;
    weather_code: number;
    wind_speed_10m?: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

export interface NominatimResponse {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

export interface DailyForecast {
  date: string;
  dayName: string;
  max: number;
  min: number;
  weatherCode: number;
  weatherDescription: string;
}

export interface WeatherData {
  city: string;
  currentTemp: number;
  feelsLike: number;
  weatherCode: number;
  weatherDescription: string;
  dailyMax: number;
  dailyMin: number;
  humidity?: number;
  windSpeed?: number;
  forecast: DailyForecast[];
}

export function getWeatherDescription(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 3) return 'Parcialmente nublado';
  if (code <= 48) return 'Niebla';
  if (code <= 55) return 'Llovizna';
  if (code <= 65) return 'Lluvia';
  if (code <= 75) return 'Nieve';
  if (code <= 82) return 'Lluvia moderada';
  if (code <= 99) return 'Tormenta';
  return 'Despejado';
}

export function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-PE', { weekday: 'short' });
}

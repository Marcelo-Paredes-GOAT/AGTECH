export interface DiagnosticoResponse {
  plaga: string;
  clase_tecnica: string;
  clima: ClimaResult;
  regla_negocio: ReglaNegocio;
  tratamiento: string;
}

export interface ClimaResult {
  humedad: number;
  condicion: string;
}

export interface ReglaNegocio {
  alerta_riesgo: boolean;
  perdida_soles: number;
}

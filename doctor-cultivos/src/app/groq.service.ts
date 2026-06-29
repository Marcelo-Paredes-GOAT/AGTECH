import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

export interface GroqContext {
  plaga: string;
  clase_tecnica: string;
  condicion: string;
  humedad: number;
  temperatura: number;
  windSpeed?: number;
  alerta: boolean;
  perdida: number;
  cantidadPlantas?: number;
  areaHectareas?: number;
  precioKg?: number;
}

@Injectable({ providedIn: 'root' })
export class GroqService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly modelo = 'llama-3.3-70b-versatile';

  generarTratamiento(contexto: GroqContext, apiKey: string): Observable<string> {
    const prompt = this.construirPrompt(contexto);

    return this.http.post<unknown>(
      this.apiUrl,
      {
        model: this.modelo,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    ).pipe(
      timeout(20000),
      map((body) => this.extraerTexto(body)),
      catchError((err) => {
        console.error('[GroqService] Error al consultar Groq:', err);
        throw err;
      }),
    );
  }

  private extraerTexto(body: unknown): string {
    try {
      const data = body as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data?.choices?.[0]?.message?.content?.trim() || '';
    } catch {
      return '';
    }
  }

  private construirPrompt(contexto: GroqContext): string {
    const textoAlerta = contexto.alerta ? 'Sí' : 'No';
    const textoPerdida = contexto.perdida > 0
      ? `S/ ${contexto.perdida.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
      : 'Sin pérdida estimada';

    const nivelRiesgo = contexto.alerta ? 'ALTO' : (contexto.humedad > 75 ? 'MODERADO' : 'BAJO');

    const textoViento = contexto.windSpeed
      ? `- Velocidad del viento: ${contexto.windSpeed} km/h`
      : '';

    const tieneEconomia = !!(contexto.cantidadPlantas || contexto.areaHectareas);
    const tienePrecio = !!contexto.precioKg;

    let datosEconomicos = '';
    if (contexto.cantidadPlantas) {
      datosEconomicos += `\n- Cantidad de plantas: ${contexto.cantidadPlantas}`;
    }
    if (contexto.areaHectareas) {
      datosEconomicos += `\n- Área cultivada: ${contexto.areaHectareas} ha`;
    }
    if (contexto.precioKg) {
      datosEconomicos += `\n- Precio estimado por kg: S/ ${contexto.precioKg.toFixed(2)}`;
    }

    const textoSecciones = tieneEconomia
      ? `## 🛡️ Prevención
Explica cómo evitar nuevos brotes considerando también el clima actual (${contexto.condicion}, ${contexto.humedad}% humedad).

## 📊 Impacto económico estimado
Evalúa el impacto económico considerando los siguientes datos del cultivo proporcionados por el agricultor:${datosEconomicos}

Analiza específicamente:
- Cómo el tamaño del cultivo afecta el riesgo de propagación
- Cómo influye el clima actual (${contexto.condicion}, ${contexto.humedad}% humedad, ${contexto.temperatura}°C${contexto.windSpeed ? `, viento ${contexto.windSpeed} km/h` : ''}) en la velocidad de propagación
- Qué tan rápido podría propagarse la enfermedad (${contexto.plaga}) en un cultivo de estas dimensiones
- Qué porcentaje aproximado del cultivo podría verse comprometido si no se actúa
- Qué tan urgente es intervenir${tienePrecio ? `\n\nAdemás, con un precio aproximado de S/ ${contexto.precioKg!.toFixed(2)} por kilogramo, realiza una estimación económica aproximada de las posibles pérdidas. Menciona un rango estimado usando frases como "aproximadamente entre X y Y soles".` : ''}

IMPORTANTE:
- No inventes cifras exactas ni garantices montos
- Siempre indica que se trata de una estimación realizada mediante IA
- Usa frases como "aproximadamente", "se estima que", "podría representar"
- Relaciona explícitamente la enfermedad detectada y el clima actual con la estimación

## ⚠️ Advertencias`
      : `## 🛡️ Prevención
Explica cómo evitar nuevos brotes considerando también el clima actual (${contexto.condicion}, ${contexto.humedad}% humedad).

## ⚠️ Advertencias`;

    return `
Eres un ingeniero agrónomo especializado en fitopatología con experiencia en análisis de riesgo climático y evaluación de impacto económico en cultivos.

## DATOS DEL DIAGNÓSTICO

Enfermedad detectada: ${contexto.plaga}
Nombre técnico: ${contexto.clase_tecnica}

## CLIMA ACTUAL DEL CULTIVO (medido en tiempo real)
- Temperatura: ${contexto.temperatura}°C
- Humedad relativa: ${contexto.humedad}%
- Condición climática: ${contexto.condicion}${textoViento}
- Nivel de riesgo: ${nivelRiesgo}
- Alerta financiera: ${textoAlerta}
- Pérdida económica estimada por el sistema: ${textoPerdida}${datosEconomicos}

## INSTRUCCIONES

Actúa como un ingeniero agrónomo en campo. Analiza la enfermedad DETECTADA y el CLIMA REAL del cultivo.
Debes relacionar directamente la enfermedad con los datos climáticos proporcionados.
No des recomendaciones genéricas. Cada recomendación debe considerar la humedad de ${contexto.humedad}%, la temperatura de ${contexto.temperatura}°C y la condición "${contexto.condicion}".

Ejemplo de razonamiento esperado:
"Se detectó ${contexto.plaga}. Actualmente la humedad es del ${contexto.humedad}% y el clima presenta ${contexto.condicion}. Estas condiciones favorecen el desarrollo de hongos, por lo que existe un alto riesgo de que la infección aumente durante los próximos días si no se actúa rápidamente."

Responde en español.
Máximo 700 palabras.
No inventes datos científicos.
No inventes productos comerciales.
Usa expresiones como "en pocos días", "rápidamente", "durante las próximas jornadas", "si continúan estas condiciones", "el riesgo seguirá aumentando".

La respuesta DEBE contener exactamente estas secciones con estos encabezados literales, en este orden:

## 🌦️ Análisis según tu clima actual
Analiza EXCLUSIVAMENTE la humedad (${contexto.humedad}%), temperatura (${contexto.temperatura}°C) y condición climática (${contexto.condicion})${contexto.windSpeed ? `, y la velocidad del viento (${contexto.windSpeed} km/h)` : ''}. Explica cómo influye este clima en la enfermedad detectada (${contexto.plaga}), si favorece su propagación, el nivel de riesgo y qué puede ocurrir si continúan estas condiciones. Debe sentirse como un análisis personalizado para el agricultor.

## ⏳ Evolución probable
Explica qué podría ocurrir durante los próximos días si el agricultor no actúa. Usa expresiones como "rápidamente", "en pocos días", "progresivamente", "durante la próxima semana", "mientras continúe este clima". Relaciona la evolución con la enfermedad (${contexto.plaga}) y las condiciones climáticas actuales. No inventes tiempos exactos.

## ✅ Acciones inmediatas
Lista clara de acciones prioritarias con viñetas.

## 💊 Tratamiento recomendado
Explica tratamientos recomendados. Si existen principios activos conocidos para ${contexto.plaga} puedes mencionarlos. No inventes productos comerciales.

${textoSecciones}
Recomendaciones importantes para el agricultor.

IMPORTANTE: Si los datos del cultivo (cantidad de plantas o hectáreas) aparecen en la sección "CLIMA ACTUAL DEL CULTIVO", entonces DEBES incluir la sección "📊 Impacto económico estimado". Si NO aparecen esos datos, omite esa sección completamente.
`.trim();
  }
}

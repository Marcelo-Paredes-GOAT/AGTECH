"""
Doctor Cultivos IA — Backend de Inferencia
FastAPI + MobileNetV3 (TorchScript) + Open-Meteo
Desplegado en Render
"""

import os
import io
import math
import logging
from pathlib import Path

import requests
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ─── Logging ───────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doctor-cultivos")

# ─── App ───────────────────────────────────────────────────────────
app = FastAPI(title="Doctor Cultivos IA — API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ────────────────────────────────────────────────────────
GOOGLE_DRIVE_FILE_ID = "1g8Cv2-uX_ixbOMtIi6ncNFTVb89suGpA"
MODEL_PATH = Path("plant_disease_mobilenet_v3_final.pt")

# ─── 38 Clases PlantVillage (orden estándar) ───────────────────────
CLASS_NAMES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

# ─── Tratamientos en español ──────────────────────────────────────
TRATAMIENTOS: dict[str, dict[str, str]] = {
    "Apple___Apple_scab": {
        "nombre_comun": "Sarna del Manzano",
        "causa": "Hongo Venturia inaequalis",
        "tratamiento": "Aplicar fungicida protectante (Captan o Mancozeb) cada 7-10 días. "
                       "En otoño, recolectar y destruir hojas caídas para reducir el inóculo.",
        "prevencion": "Poda de aireación y variedades resistentes.",
    },
    "Apple___Black_rot": {
        "nombre_comun": "Pudrición Negra del Manzano",
        "causa": "Hongo Botryosphaeria obtusa",
        "tratamiento": "Eliminar ramas y frutos infectados. Aplicar fungicida a base de cobre "
                       "o azufre después de la poda.",
        "prevencion": "Poda sanitaria y evitar heridas en el tronco.",
    },
    "Apple___Cedar_apple_rust": {
        "nombre_comun": "Roya del Manzano y Enebro",
        "causa": "Hongo Gymnosporangium juniperi-virginianae",
        "tratamiento": "Aplicar fungicida a base de miclobutanil o azufre en primavera. "
                       "Eliminar enebros cercanos si es posible.",
        "prevencion": "Evitar plantar enebros cerca del huerto.",
    },
    "Apple___healthy": {
        "nombre_comun": "Manzano Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento. Continúe con su plan de manejo integrado.",
        "prevencion": "Mantener buenas prácticas de cultivo.",
    },
    "Blueberry___healthy": {
        "nombre_comun": "Arándano Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento. Continúe con el monitoreo rutinario.",
        "prevencion": "Suelo ácido (pH 4.5-5.5) y riego por goteo.",
    },
    "Cherry_(including_sour)___Powdery_mildew": {
        "nombre_comun": "Oídio del Cerezo",
        "causa": "Hongo Podosphaera clandestina",
        "tratamiento": "Aplicar azufre mojable o bicarbonato de potasio cada 7-14 días. "
                       "En casos severos, usar miclobutanil.",
        "prevencion": "Poda para mejorar circulación de aire y evitar estrés hídrico.",
    },
    "Cherry_(including_sour)___healthy": {
        "nombre_comun": "Cerezo Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Monitoreo periódico y manejo integrado de plagas.",
    },
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "nombre_comun": "Mancha Gris del Maíz",
        "causa": "Hongo Cercospora zeae-maydis",
        "tratamiento": "Aplicar fungicida estrobilurina (azoxistrobina) en etapa V6-V10. "
                       "Rotar con fungicida triazol en aplicación posterior.",
        "prevencion": "Rotación de cultivos y uso de híbridos tolerantes.",
    },
    "Corn_(maize)___Common_rust_": {
        "nombre_comun": "Roya Común del Maíz",
        "causa": "Hongo Puccinia sorghi",
        "tratamiento": "Aplicar fungicida a base de azufre o triazol ante los primeros síntomas.",
        "prevencion": "Sembrar variedades resistentes y evitar siembras tardías.",
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "nombre_comun": "Tizón Foliar del Norte",
        "causa": "Hongo Exserohilum turcicum",
        "tratamiento": "Aplicar fungicida protectante (Mancozeb) o sistémico (Propiconazol) "
                       "al detectar síntomas en hojas inferiores.",
        "prevencion": "Rotación de cultivos y uso de semilla tratada.",
    },
    "Corn_(maize)___healthy": {
        "nombre_comun": "Maíz Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Mantener fertilización balanceada y monitoreo de plagas.",
    },
    "Grape___Black_rot": {
        "nombre_comun": "Pudrición Negra de la Vid",
        "causa": "Hongo Guignardia bidwellii",
        "tratamiento": "Aplicar fungicida a base de cobre o Mancozeb cada 10-14 días "
                       "desde brotación hasta envero.",
        "prevencion": "Eliminar racimos momificados y poda de aireación.",
    },
    "Grape___Esca_(Black_Measles)": {
        "nombre_comun": "Yesca o Sarampión Negro",
        "causa": "Complejo de hongos (Phaeomoniella, Phaeoacremonium, Fomitiporia)",
        "tratamiento": "No existe cura química. Realizar poda quirúrgica removiendo "
                       "madera muerta y aplicar pasta cicatrizante con fungicida.",
        "prevencion": "Evitar heridas grandes de poda y proteger cortes con pasta fungicida.",
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "nombre_comun": "Tizón Foliar de la Vid",
        "causa": "Hongo Isariopsis clavispora",
        "tratamiento": "Aplicar fungicida cúprico o Mancozeb al detectar síntomas.",
        "prevencion": "Mantener cobertura vegetal controlada y buena ventilación.",
    },
    "Grape___healthy": {
        "nombre_comun": "Vid Sana",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Manejo integrado del viñedo.",
    },
    "Orange___Haunglongbing_(Citrus_greening)": {
        "nombre_comun": "Huanglongbing (Dragón Amarillo)",
        "causa": "Bacteria Candidatus Liberibacter spp. transmitida por psílido asiático",
        "tratamiento": "No existe cura. Eliminar árboles infectados de inmediato. "
                       "Controlar psílido vector con insecticidas sistémicos "
                       "(Imidacloprid) y aceite de neem.",
        "prevencion": "Usar plantas certificadas, barreras vivas y control biológico del vector.",
    },
    "Peach___Bacterial_spot": {
        "nombre_comun": "Mancha Bacteriana del Durazno",
        "causa": "Bacteria Xanthomonas arboricola pv. pruni",
        "tratamiento": "Aplicar bactericida a base de cobre (oxicloruro de cobre) "
                       "en caída de hojas y antes de floración.",
        "prevencion": "Variedades resistentes y evitar riego por aspersión.",
    },
    "Peach___healthy": {
        "nombre_comun": "Durazno Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Poda de formación y fertilización balanceada.",
    },
    "Pepper,_bell___Bacterial_spot": {
        "nombre_comun": "Mancha Bacteriana del Pimiento",
        "causa": "Bacteria Xanthomonas campestris pv. vesicatoria",
        "tratamiento": "Aplicar cobre cada 7-10 días. Rotar con estreptomicina "
                       "agrícola en casos severos.",
        "prevencion": "Semilla certificada y evitar mojar follaje.",
    },
    "Pepper,_bell___healthy": {
        "nombre_comun": "Pimiento Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Mantener programa de fertilización y riego.",
    },
    "Potato___Early_blight": {
        "nombre_comun": "Tizón Temprano de la Papa",
        "causa": "Hongo Alternaria solani",
        "tratamiento": "Aplicar fungicida protectante (Mancozeb, Clorotalonil) cada 7-10 días. "
                       "Usar fungicida sistémico (Azoxistrobina) en rotación.",
        "prevencion": "Rotación de cultivos (evitar solanáceas) y eliminar residuos.",
    },
    "Potato___Late_blight": {
        "nombre_comun": "Tizón Tardío de la Papa",
        "causa": "Pseudomonas syringae pv. tomato",
        "tratamiento": "Aplicar fungicida específico (Metalaxil + Mancozeb) de inmediato. "
                       "Repetir cada 5-7 días en clima húmedo. Destruir tejido infectado.",
        "prevencion": "Variedades resistentes, drenaje adecuado y monitoreo constante.",
    },
    "Potato___healthy": {
        "nombre_comun": "Papa Sana",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Semilla certificada y rotación de cultivos.",
    },
    "Raspberry___healthy": {
        "nombre_comun": "Frambuesa Sana",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Suelo bien drenado y poda anual de renovación.",
    },
    "Soybean___healthy": {
        "nombre_comun": "Soja Sana",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Rotación de cultivos y control de malezas.",
    },
    "Squash___Powdery_mildew": {
        "nombre_comun": "Oídio de la Calabaza",
        "causa": "Hongo Podosphaera xanthii",
        "tratamiento": "Aplicar azufre mojable o bicarbonato de potasio cada 7 días. "
                       "En alta presión, usar miclobutanil o trifloxistrobina.",
        "prevencion": "Evitar exceso de nitrógeno y espaciamiento adecuado.",
    },
    "Strawberry___Leaf_scorch": {
        "nombre_comun": "Quemadura Foliar de la Fresa",
        "causa": "Hongo Diplocarpon earlianum",
        "tratamiento": "Aplicar fungicida a base de cobre o Captan después de cosecha. "
                       "Eliminar hojas viejas infectadas.",
        "prevencion": "Plantar en camas elevadas con buena circulación de aire.",
    },
    "Strawberry___healthy": {
        "nombre_comun": "Fresa Sana",
        "causa": "",
        "tratamiento": "No se requiere tratamiento.",
        "prevencion": "Riego por goteo y acolchado plástico.",
    },
    "Tomato___Bacterial_spot": {
        "nombre_comun": "Mancha Bacteriana del Tomate",
        "causa": "Bacteria Xanthomonas campestris pv. vesicatoria",
        "tratamiento": "Aplicar bactericida a base de cobre cada 7-10 días. "
                       "Rotar con mancozeb en aplicaciones alternadas.",
        "prevencion": "Semilla certificada y evitar riego por aspersión.",
    },
    "Tomato___Early_blight": {
        "nombre_comun": "Tizón Temprano del Tomate",
        "causa": "Hongo Alternaria solani",
        "tratamiento": "Aplicar fungicida a base de clorotalonil o mancozeb cada 7 días. "
                       "Usar azoxistrobina en rotación para evitar resistencia.",
        "prevencion": "Mulching, poda de ramas bajas y rotación de cultivos.",
    },
    "Tomato___Late_blight": {
        "nombre_comun": "Tizón Tardío del Tomate",
        "causa": "Oomiceto Phytophthora infestans",
        "tratamiento": "Aplicar fungicida específico (Metalaxil-M + Mancozeb) de forma urgente "
                       "cada 5-7 días. Eliminar y destruir plantas infectadas para evitar "
                       "propagación. En cultivos orgánicos usar caldo bordelés o cobre.",
        "prevencion": "Variedades resistentes, evitar exceso de humedad foliar, "
                      "y monitorear condiciones climáticas (temperatura 10-25°C + humedad >80%).",
    },
    "Tomato___Leaf_Mold": {
        "nombre_comun": "Moho de la Hoja del Tomate",
        "causa": "Hongo Passalora fulva (Cladosporium fulvum)",
        "tratamiento": "Aplicar fungicida a base de azufre o clorotalonil. "
                       "Mejorar ventilación del invernadero.",
        "prevencion": "Reducir humedad relativa (<85%) y espaciamiento entre plantas.",
    },
    "Tomato___Septoria_leaf_spot": {
        "nombre_comun": "Mancha Septoria del Tomate",
        "causa": "Hongo Septoria lycopersici",
        "tratamiento": "Aplicar fungicida protectante (Mancozeb, Clorotalonil) cada 7-10 días "
                       "iniciando al primer síntoma.",
        "prevencion": "Eliminar hojas inferiores infectadas y evitar salpicadura de agua.",
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "nombre_comun": "Araña Roja (Tetranychus urticae)",
        "causa": "Ácaro Tetranychus urticae",
        "tratamiento": "Aplicar acaricida específico (Abamectina o aceite de neem). "
                       "En invernadero, liberar ácaros depredadores (Phytoseiulus).",
        "prevencion": "Mantener humedad adecuada y evitar estrés hídrico.",
    },
    "Tomato___Target_Spot": {
        "nombre_comun": "Mancha Anillada del Tomate",
        "causa": "Hongo Corynespora cassiicola",
        "tratamiento": "Aplicar fungicida sistémico (Boscalid + Piraclostrobina) "
                       "alternando con Mancozeb cada 7-10 días.",
        "prevencion": "Rotación de cultivos y semilla certificada.",
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "nombre_comun": "Virus del Enrollamiento Amarillo (TYLCV)",
        "causa": "Begomovirus transmitido por mosca blanca (Bemisia tabaci)",
        "tratamiento": "No existe tratamiento curativo. Controlar vector con insecticidas "
                       "(Imidacloprid, Buprofezin) y barreras físicas (malla anti-insectos). "
                       "Eliminar plantas infectadas.",
        "prevencion": "Variedades tolerantes, control de mosca blanca y mallas en invernaderos.",
    },
    "Tomato___Tomato_mosaic_virus": {
        "nombre_comun": "Virus del Mosaico del Tomate (ToMV)",
        "causa": "Tobamovirus altamente contagioso",
        "tratamiento": "No existe tratamiento curativo. Eliminar plantas afectadas. "
                       "Desinfectar herramientas y manos con leche descremada al 20%.",
        "prevencion": "Semilla certificada resistente y rotación de cultivos.",
    },
    "Tomato___healthy": {
        "nombre_comun": "Tomate Sano",
        "causa": "",
        "tratamiento": "No se requiere tratamiento. Continúe con su plan de manejo preventivo.",
        "prevencion": "Monitoreo semanal y buenas prácticas agrícolas.",
    },
}

FALLBACK_TRATAMIENTO: dict[str, str] = {
    "nombre_comun": "Enfermedad no identificada en base de datos",
    "causa": "Desconocida",
    "tratamiento": "De momento no se registra un tratamiento específico en el diccionario estático.",
    "prevencion": "Mantenga registro fitosanitario del cultivo.",
}

# ─── Descarga del modelo desde Google Drive ──────────────────────
def descargar_modelo(file_id: str, output_path: Path) -> None:
    """
    Descarga el modelo TorchScript desde Google Drive
    saltando la pantalla de confirmación de archivos grandes.
    """
    if output_path.exists():
        logger.info(f"Modelo ya existe en {output_path}")
        return

    logger.info("Descargando modelo desde Google Drive...")
    session = requests.Session()

    # Primera solicitud — obtiene cookie de confirmación
    url_confirm = "https://docs.google.com/uc?export=download"
    r = session.get(url_confirm, params={"id": file_id}, stream=True)

    confirm_token = None
    for key, value in r.cookies.items():
        if key.startswith("download_warning"):
            confirm_token = value
            break

    # Segunda solicitud con token de confirmación
    url_download = "https://docs.google.com/uc?export=download"
    params: dict[str, str] = {"id": file_id}
    if confirm_token:
        params["confirm"] = confirm_token

    r = session.get(url_download, params=params, stream=True)
    r.raise_for_status()

    with open(output_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)

    logger.info(f"Modelo descargado: {output_path} ({output_path.stat().st_size / 1e6:.1f} MB)")


# ─── Carga del modelo ──────────────────────────────────────────────
def cargar_modelo(path: Path):
    logger.info("Cargando modelo TorchScript en CPU...")
    try:
        model = torch.jit.load(str(path), map_location=torch.device("cpu"))
        model.eval()
        logger.info("Modelo cargado correctamente")
        return model
    except Exception as e:
        logger.error(f"Error al cargar el modelo: {e}")
        raise RuntimeError(f"No se pudo cargar el modelo: {e}")


# ─── Preprocesamiento de imagen ────────────────────────────────────
IMAGEN_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def preprocesar(imagen_bytes: bytes) -> torch.Tensor:
    imagen = Image.open(io.BytesIO(imagen_bytes)).convert("RGB")
    tensor = IMAGEN_TRANSFORMS(imagen)
    tensor = tensor.unsqueeze(0)  # [1, 3, 224, 224]
    return tensor


# ─── Consulta climática (Open-Meteo) ──────────────────────────────
CODIGOS_CLIMA: dict[int, str] = {
    0:  "Despejado",
    1:  "Mayormente despejado",
    2:  "Parcialmente nublado",
    3:  "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna densa",
    56: "Llovizna helada ligera",
    57: "Llovizna helada densa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia fuerte",
    66: "Lluvia helada ligera",
    67: "Lluvia helada fuerte",
    71: "Nevada ligera",
    73: "Nevada moderada",
    75: "Nevada fuerte",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos violentos",
    85: "Chubascos de nieve ligeros",
    86: "Chubascos de nieve fuertes",
    95: "Tormenta eléctrica",
    96: "Tormenta con granizo ligero",
    99: "Tormenta con granizo fuerte",
}


def obtener_clima(lat: float, lon: float) -> dict:
    """Consulta Open-Meteo (gratuito, sin API key)."""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "weather_code",
                "precipitation",
            ],
            "timezone": "auto",
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        current = data["current"]

        codigo = current.get("weather_code", 0)
        condicion = CODIGOS_CLIMA.get(codigo, "Desconocido")

        es_lluvia = codigo in {51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99}

        return {
            "condicion": condicion,
            "temperatura": round(current["temperature_2m"], 1),
            "humedad": round(current["relative_humidity_2m"], 1),
            "precipitacion": current.get("precipitation", 0),
            "es_lluvia": es_lluvia,
        }
    except Exception as e:
        logger.warning(f"Error al consultar clima: {e}")
        return {
            "condicion": "No disponible",
            "temperatura": 0,
            "humedad": 0,
            "precipitacion": 0,
            "es_lluvia": False,
        }


# ─── Descargar y cargar modelo al iniciar ──────────────────────────
try:
    descargar_modelo(GOOGLE_DRIVE_FILE_ID, MODEL_PATH)
    model = cargar_modelo(MODEL_PATH)
except Exception as e:
    logger.error(f"Error fatal al preparar el modelo: {e}")
    model = None


# ─── Endpoint principal ────────────────────────────────────────────
@app.post("/diagnosticar")
async def diagnosticar(
    lat: float = Form(...),
    lon: float = Form(...),
    file: UploadFile = File(...),
):
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo de IA no disponible")

    # 1. Leer imagen
    imagen_bytes = await file.read()
    if not imagen_bytes:
        raise HTTPException(status_code=400, detail="Archivo de imagen vacío")

    # 2. Preprocesar
    tensor = preprocesar(imagen_bytes)

    # 3. Inferencia
    try:
        with torch.no_grad():
            logits = model(tensor)
            probs = F.softmax(logits, dim=1)
            prob, idx = torch.max(probs, dim=1)
            clase = CLASS_NAMES[idx.item()]
            confianza = round(prob.item() * 100, 2)
    except Exception as e:
        logger.error(f"Error en inferencia: {e}")
        raise HTTPException(status_code=500, detail=f"Error en inferencia: {e}")

    # 4. Clima
    clima_data = obtener_clima(lat, lon)

    # 5. Tratamiento
    tx_info = TRATAMIENTOS.get(clase, FALLBACK_TRATAMIENTO)

    # 6. Regla de negocio — pérdida financiera
    alerta_riesgo = False
    perdida_soles = 0

    if (
        clase == "Tomato___Late_blight"
        and clima_data["humedad"] > 80
        and clima_data["es_lluvia"]
    ):
        alerta_riesgo = True
        # Fórmula base: 5000 Soles por hectárea afectada
        hectareas_estimadas = 2.5
        perdida_soles = 5000 * hectareas_estimadas

    # 7. Respuesta
    return {
        "plaga": tx_info["nombre_comun"],
        "clase_tecnica": clase,
        "confianza": confianza,
        "clima": {
            "condicion": clima_data["condicion"],
            "temperatura": clima_data["temperatura"],
            "humedad": clima_data["humedad"],
        },
        "regla_negocio": {
            "alerta_riesgo": alerta_riesgo,
            "perdida_soles": perdida_soles,
        },
        "tratamiento": tx_info["tratamiento"],
    }


# ─── Health check ──────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": "Doctor Cultivos IA",
        "version": "1.0.0",
        "modelo_cargado": model is not None,
        "clases": len(CLASS_NAMES),
    }


# ─── Entry point ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

"""
Service SigLIP — génération d'embeddings visuels.
Lancer : python -m uvicorn main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import base64
import io
import logging
import os
import traceback
from typing import List

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from transformers import SiglipImageProcessor, SiglipVisionModel

MODEL_ID = os.getenv("SIGLIP_MODEL", "google/siglip-base-patch16-224")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("siglip-embed")

app = FastAPI(title="SigLIP Embed", version="1.1.0")

_processor: SiglipImageProcessor | None = None
_model: SiglipVisionModel | None = None
_device = "cuda" if torch.cuda.is_available() else "cpu"


def get_model() -> tuple[SiglipImageProcessor, SiglipVisionModel]:
    global _processor, _model
    if _model is None:
        logger.info("Chargement du modèle %s sur %s…", MODEL_ID, _device)
        _processor = SiglipImageProcessor.from_pretrained(MODEL_ID)
        _model = SiglipVisionModel.from_pretrained(MODEL_ID).to(_device)
        _model.eval()
        logger.info("Modèle prêt.")
    return _processor, _model


class EmbedRequest(BaseModel):
    image_base64: str


class EmbedResponse(BaseModel):
    embedding: List[float]
    model: str
    dims: int


def decode_image(data: str) -> Image.Image:
    raw = data.strip()
    if "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(raw, validate=True)
        image = Image.open(io.BytesIO(img_bytes))
        image.load()
        return image.convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image invalide : {e}") from e


def normalize(vec: torch.Tensor) -> torch.Tensor:
    return vec / vec.norm(p=2, dim=-1, keepdim=True).clamp(min=1e-12)


def extract_pooler(features: torch.Tensor | object) -> torch.Tensor:
    if isinstance(features, torch.Tensor):
        return features
    if hasattr(features, "pooler_output") and features.pooler_output is not None:
        return features.pooler_output
    if hasattr(features, "last_hidden_state"):
        # fallback : moyenne des tokens
        return features.last_hidden_state.mean(dim=1)
    raise TypeError(f"Sortie modèle non reconnue : {type(features)}")


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": MODEL_ID,
        "device": _device,
        "model_loaded": _model is not None,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    try:
        image = decode_image(req.image_base64)
        processor, model = get_model()

        inputs = processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(_device)

        with torch.no_grad():
            outputs = model(pixel_values=pixel_values)
            features = normalize(extract_pooler(outputs))

        embedding = features[0].cpu().tolist()
        return EmbedResponse(embedding=embedding, model=MODEL_ID, dims=len(embedding))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erreur /embed : %s\n%s", e, traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "type": type(e).__name__},
        )


@app.exception_handler(Exception)
def unhandled_exception_handler(_request, exc: Exception):
    logger.error("Erreur non gérée : %s\n%s", exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )

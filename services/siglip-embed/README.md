# Service SigLIP (embeddings visuels)

## Démarrage local (Python)

```bash
cd services/siglip-embed
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8001
```

> Utilisez **`python -m uvicorn`** (pas `uvicorn` global pyenv) pour activer le venv.

Puis dans `.env.local` du projet Next :

```bash
SIGLIP_SERVICE_URL=http://localhost:8001
```

## Docker

```bash
docker build -t demonstrator-siglip ./services/siglip-embed
docker run --rm -p 8001:8001 demonstrator-siglip
```

Le premier démarrage télécharge le modèle Hugging Face (~400 Mo).

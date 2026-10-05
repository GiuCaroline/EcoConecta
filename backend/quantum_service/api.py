"""Serviço interno. Somente o backend Node deve chamar este endpoint."""
from pathlib import Path
import hmac
import os
from typing import Annotated
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .circuit import evaluate_volumes

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
SERVICE_KEY = os.getenv("QUANTUM_API_KEY", "")
if len(SERVICE_KEY) < 32:
    raise RuntimeError("Configure QUANTUM_API_KEY com pelo menos 32 caracteres no .env do backend.")

app = FastAPI(title="EcoConecta · PennyLane", docs_url=None, redoc_url=None, openapi_url=None)

class QuantumInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    volumeA: float = Field(gt=0, le=100000)
    volumeB: float = Field(gt=0, le=100000)
    referenceKg: float = Field(gt=0, le=100000)


def authenticate(x_api_key: Annotated[str | None, Header()] = None):
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), SERVICE_KEY.encode()):
        raise HTTPException(status_code=401, detail="Acesso interno não autorizado.")

@app.get("/health", dependencies=[Depends(authenticate)])
def health():
    return {"status": "ok", "engine": "PennyLane/default.qubit", "qubits": 2}

@app.post("/evaluate", dependencies=[Depends(authenticate)])
def evaluate(data: QuantumInput):
    return evaluate_volumes(data.volumeA, data.volumeB, data.referenceKg)

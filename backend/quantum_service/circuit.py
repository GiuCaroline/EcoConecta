"""Circuito original do grupo, executado no simulador default.qubit.

Projeto: EcoConecta
Autores: Daniel Pereira Rodrigues de Lima, Giulia Caroline Claro
         e João Victor da Silva Jardim.

Este circuito compara dois candidatos; não resolve um problema de menor
percurso, não treina parâmetros e não demonstra vantagem quântica.
"""
from threading import RLock
import math
import pennylane as qml
from pennylane import numpy as np

# 1. Dispositivo com exatamente 2 qubits. shots=None usa probabilidades exatas.
dev = qml.device("default.qubit", wires=2, shots=None)

# 2. Circuito preservado: RX para A, RX para B, CNOT e probs.
@qml.qnode(dev)
def otimizador_rotas_ecoconecta(urgencia_A, urgencia_B):
    qml.RX(urgencia_A, wires=0)
    qml.RX(urgencia_B, wires=1)
    qml.CNOT(wires=[0, 1])
    return qml.probs(wires=[0, 1])

# O QNode/dispositivo é compartilhado entre chamadas de um mesmo processo.
_lock = RLock()
STATES = ["00", "01", "10", "11"]
ROUTES = {
    0: "Não visitar nenhum hoje (00)",
    1: "Visitar apenas o Vizinho B (01)",
    2: "Visitar apenas o Vizinho A (10)",
    3: "Visitar ambos, começando pelo de maior urgência (11)",
}


def evaluate_angles(urgencia_A: float, urgencia_B: float) -> dict:
    if not all(math.isfinite(v) and 0 <= v <= math.pi for v in [urgencia_A, urgencia_B]):
        raise ValueError("Ângulos precisam estar entre 0 e pi.")
    with _lock:
        probabilities = otimizador_rotas_ecoconecta(urgencia_A, urgencia_B)
        values = [float(value) for value in probabilities]
        # Mantém o np.argmax original. Empates exatos escolhem o primeiro estado.
        best_index = int(np.argmax(probabilities))
    order = []
    if best_index == 1:
        order = ["B"]
    elif best_index == 2:
        order = ["A"]
    elif best_index == 3:
        # Ordem adicionada por regra clássica, não calculada pelo circuito.
        order = ["A", "B"] if urgencia_A >= urgencia_B else ["B", "A"]
    return {
        "states": STATES,
        "probabilities": values,
        "bestIndex": best_index,
        "bestState": STATES[best_index],
        "decision": ROUTES[best_index],
        "visitOrder": order,
        "angles": {"A": float(urgencia_A), "B": float(urgencia_B)},
        "engine": "PennyLane/default.qubit",
        "qubits": 2,
        "simulated": True,
        "educational": True,
    }


def normalize_volume(volume_kg: float, reference_kg: float) -> float:
    if not math.isfinite(volume_kg) or volume_kg <= 0:
        raise ValueError("Peso estimado precisa ser positivo.")
    if not math.isfinite(reference_kg) or reference_kg <= 0:
        raise ValueError("Referência precisa ser positiva.")
    return min(volume_kg / reference_kg, 1.0) * math.pi


def evaluate_volumes(volume_A: float, volume_B: float, reference_kg: float) -> dict:
    angle_A = normalize_volume(volume_A, reference_kg)
    angle_B = normalize_volume(volume_B, reference_kg)
    result = evaluate_angles(angle_A, angle_B)
    result["inputs"] = {"volumeA": volume_A, "volumeB": volume_B, "referenceKg": reference_kg}
    result["normalization"] = "angle = min(quantityKg / referenceKg, 1) * pi"
    return result

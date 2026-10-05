"""Exemplo original do grupo: A=pi/4 e B=pi. Rode como módulo."""
from pennylane import numpy as np
from .circuit import otimizador_rotas_ecoconecta, ROUTES

if __name__ == "__main__":
    volume_vizinho_A = np.pi / 4
    volume_vizinho_B = np.pi
    probabilidades = otimizador_rotas_ecoconecta(volume_vizinho_A, volume_vizinho_B)
    print("=== Resultados da Otimização Quântica EcoConecta ===\n")
    print("Probabilidade de cada rota (00, 01, 10, 11):")
    print(np.round(probabilidades, 4))
    melhor_rota_index = int(np.argmax(probabilidades))
    print(f"\nDecisão Logística Recomendada: {ROUTES[melhor_rota_index]}")

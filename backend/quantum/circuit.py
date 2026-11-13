import json
import math
import sys


def compute_analytical(angle_a: float, angle_b: float) -> list[float]:
    cos_a = math.cos(angle_a / 2.0)
    sin_a = math.sin(angle_a / 2.0)
    cos_b = math.cos(angle_b / 2.0)
    sin_b = math.sin(angle_b / 2.0)
    return [
        (cos_a * cos_b) ** 2,
        (cos_a * sin_b) ** 2,
        (sin_a * sin_b) ** 2,
        (sin_a * cos_b) ** 2,
    ]


def run_circuit(volume_a: float, volume_b: float, reference_kg: float = 20.0) -> dict:
    if reference_kg <= 0:
        raise ValueError("referenceKg must be greater than zero")

    angle_a = (float(volume_a) / float(reference_kg)) * math.pi
    angle_b = (float(volume_b) / float(reference_kg)) * math.pi

    try:
        import pennylane as qml

        dev = qml.device("default.qubit", wires=2)

        @qml.qnode(dev)
        def circuit(a: float, b: float):
            qml.RX(a, wires=0)
            qml.RX(b, wires=1)
            qml.CNOT(wires=[0, 1])
            return qml.probs(wires=[0, 1])

        probabilities = [float(p) for p in circuit(angle_a, angle_b)]
    except ImportError:
        probabilities = compute_analytical(angle_a, angle_b)

    return {
        "states": ["00", "01", "10", "11"],
        "probabilities": probabilities,
        "angles": {"A": angle_a, "B": angle_b},
    }


def main() -> None:
    raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(raw)
    volume_a = float(payload.get("volumeA", 0))
    volume_b = float(payload.get("volumeB", 0))
    reference_kg = float(payload.get("referenceKg", 20))

    result = run_circuit(volume_a, volume_b, reference_kg)
    print(json.dumps(result))


if __name__ == "__main__":
    main()

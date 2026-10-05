import math
import os
import unittest
from .circuit import evaluate_angles, evaluate_volumes, normalize_volume

# Chave fictícia somente para os testes, não uma credencial de implantação.
os.environ.setdefault("QUANTUM_API_KEY", "quantum-test-key-" + "x" * 40)
from fastapi.testclient import TestClient
from .api import app, SERVICE_KEY

class QuantumTests(unittest.TestCase):
    def test_original_example(self):
        result = evaluate_angles(math.pi / 4, math.pi)
        expected = [0, (2 + math.sqrt(2)) / 4, (2 - math.sqrt(2)) / 4, 0]
        for got, want in zip(result["probabilities"], expected):
            self.assertAlmostEqual(got, want, places=12)
        self.assertEqual(result["bestState"], "01")
        self.assertEqual(result["visitOrder"], ["B"])

    def test_normalization_matches_original_angles(self):
        result = evaluate_volumes(5, 20, 20)
        self.assertAlmostEqual(result["angles"]["A"], math.pi / 4)
        self.assertAlmostEqual(result["angles"]["B"], math.pi)
        self.assertEqual(result["bestState"], "01")
        self.assertEqual(normalize_volume(50, 20), math.pi)

    def test_probabilities_are_normalized(self):
        for a, b in [(0, 0), (math.pi, 0), (0, math.pi), (math.pi, math.pi), (.7, 1.2)]:
            r = evaluate_angles(a, b)
            self.assertAlmostEqual(sum(r["probabilities"]), 1, places=12)
            self.assertTrue(all(0 <= p <= 1 + 1e-12 for p in r["probabilities"]))

    def test_directional_cnot_is_not_a_generic_urgency_optimizer(self):
        # Duas urgências máximas retornam 10, não 11. Preserve o circuito;
        # não invente uma promessa de ótima rota por volume/distância.
        self.assertEqual(evaluate_angles(math.pi, math.pi)["bestState"], "10")
        self.assertEqual(evaluate_angles(math.pi, 0)["bestState"], "11")

    def test_both_visit_order_is_classical(self):
        r = evaluate_angles(math.pi, 0)
        self.assertEqual(r["visitOrder"], ["A", "B"])

    def test_invalid_inputs(self):
        for volume in [0, -1, float('nan'), float('inf')]:
            with self.assertRaises(ValueError):
                normalize_volume(volume, 20)
        for angle in [-1, math.pi + 1, float('nan')]:
            with self.assertRaises(ValueError):
                evaluate_angles(angle, 0)

    def test_http_requires_key_and_validates_body(self):
        client = TestClient(app)
        payload = {"volumeA": 5, "volumeB": 20, "referenceKg": 20}
        self.assertEqual(client.post('/evaluate', json=payload).status_code, 401)
        self.assertEqual(client.post('/evaluate', json=payload, headers={"X-Api-Key": "wrong"}).status_code, 401)
        good = client.post('/evaluate', json=payload, headers={"X-Api-Key": SERVICE_KEY})
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.json()["bestState"], "01")
        invalid = client.post('/evaluate', json={**payload, "volumeA": -1}, headers={"X-Api-Key": SERVICE_KEY})
        self.assertEqual(invalid.status_code, 422)

if __name__ == '__main__':
    unittest.main()

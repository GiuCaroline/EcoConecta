import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../context/AppContext";
import {
  Page,
  Heading,
  Card,
  Button,
  Chip,
  Icon,
  Empty,
  Badge,
} from "../components/UI";
import { getQuantumSessionToken, requestQuantum } from "../services/quantumApi";

const STATE_LABELS = {
  "00": "Nenhum dos dois",
  "01": "Apenas vizinho B",
  10: "Apenas vizinho A",
  11: "Ambos os vizinhos",
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function Quantum({ navigation }) {
  const { user, requests } = useApp();
  const candidates = requests.filter(
    (r) =>
      !r.cancelled &&
      (r.status === 0 || (r.status === 1 && r.driverId === user.id)),
  );
  const [mode, setMode] = useState("example");
  const [selected, setSelected] = useState(
    candidates.slice(0, 2).map((r) => r.id),
  );
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    getQuantumSessionToken()
      .then((value) => {
        if (active) setToken(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const chosen = selected
    .map((id) => candidates.find((r) => r.id === id))
    .filter(Boolean);
  const connected = Boolean(
    token && chosen.length === 2 && chosen.every((r) => UUID.test(r.id)),
  );

  function chooseMode(value) {
    if (busy) return;
    setMode(value);
    setResult(null);
    setError("");
  }
  function toggle(id) {
    if (busy) return;
    setResult(null);
    setError("");
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 2
          ? [...current, id]
          : [current[0], id],
    );
  }
  async function simulate() {
    if (busy || (mode === "requests" && chosen.length !== 2)) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const example = mode === "example";
      const inputs = example
        ? { volumeA: 5, volumeB: 20 }
        : connected
          ? { token, requestIds: chosen.map((r) => r.id) }
          : {
              volumeA: Number(chosen[0].quantity),
              volumeB: Number(chosen[1].quantity),
            };
      const response = await requestQuantum(inputs);
      setResult({
        ...response,
        candidates:
          response.candidates ||
          (example
            ? [
                { label: "A", name: "Vizinho A", quantity: 5 },
                { label: "B", name: "Vizinho B", quantity: 20 },
              ]
            : chosen.map((r, i) => ({
                label: i === 0 ? "A" : "B",
                name: r.residentName,
                quantity: r.quantity,
              }))),
        example,
      });
    } catch (err) {
      setError(err.message || "Confira sua conexão e os serviços.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="LABORATÓRIO ECOCONECTA"
        title="Sugestão quântica"
        subtitle="Dois vizinhos. Dois qubits. Um experimento com novas possibilidades."
      />
      <View className="mb-5 rounded-3xl bg-forest p-5">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon name="hardware-chip-outline" color="#c4f17b" />
          <Text className="font-bold text-lime">PennyLane · 2 qubits</Text>
        </View>
        <Text className="text-lg font-bold text-white">
          RX(A) · RX(B) · CNOT(0 → 1)
        </Text>
        <Text className="mt-2 text-sm leading-6 text-green-100">
          O peso estimado vira um ângulo. O circuito calcula as probabilidades
          dos quatro estados.
        </Text>
      </View>
      <View className="mb-3 flex-row flex-wrap">
        <Chip
          label="Exemplo do grupo"
          selected={mode === "example"}
          onPress={() => chooseMode("example")}
        />
        <Chip
          label="Comparar duas coletas"
          selected={mode === "requests"}
          onPress={() => chooseMode("requests")}
        />
      </View>
      {mode === "example" ? (
        <Card>
          <Text className="text-lg font-bold text-ink">A = π/4 · B = π</Text>
          <Text className="mt-2 text-sm leading-6 text-slate-500">
            A tem 5 kg e B tem 20 kg estimados. Com a referência padrão de 20
            kg, esses pesos reproduzem os ângulos do código enviado pelo grupo.
          </Text>
          <Text className="mt-3 text-xs font-semibold text-forest">
            Dados fictícios · nenhuma coleta será criada.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Badge
              text={
                connected
                  ? "Dados do servidor"
                  : "Demonstração com dados locais"
              }
            />
            <Text className="mt-3 text-sm leading-6 text-slate-500">
              Selecione exatamente duas coletas. A primeira selecionada será A e
              a segunda será B. O terceiro toque troca B.{" "}
              {connected
                ? "O backend verifica os pedidos e lê os pesos do banco."
                : "Neste protótipo, os pesos locais são enviados à simulação. A integração com a API permite comparar pedidos reais."}
            </Text>
          </Card>
          {candidates.length < 2 ? (
            <Empty
              title="Precisamos de dois vizinhos"
              body="Crie pelo menos duas coletas ainda não retiradas. Você pode usar o exemplo do grupo enquanto isso."
            />
          ) : (
            candidates.map((r) => {
              const index = selected.indexOf(r.id);
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: index >= 0, disabled: busy }}
                  disabled={busy}
                  onPress={() => toggle(r.id)}
                  className={`mb-3 flex-row items-center gap-3 rounded-2xl border p-4 ${index >= 0 ? "border-forest bg-mint" : "border-slate-200 bg-white"}`}
                >
                  <Icon name={index >= 0 ? "checkbox" : "square-outline"} />
                  <View className="flex-1">
                    <Text className="font-bold text-ink">
                      {index >= 0 ? `${index === 0 ? "A" : "B"} · ` : ""}
                      {r.residentName}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                      {r.quantity} kg estimados ·{" "}
                      {r.status === 0
                        ? "Aguardando motorista"
                        : "Antes da retirada"}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      )}
      <Button
        title={busy ? "Executando circuito..." : "Executar circuito PennyLane"}
        icon="hardware-chip-outline"
        disabled={busy || (mode === "requests" && chosen.length !== 2)}
        onPress={simulate}
      />
      {error ? (
        <Card>
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm leading-6 text-red-600"
          >
            {error}
          </Text>
        </Card>
      ) : null}
      {result && (
        <View className="mt-5">
          <Heading
            title="Resultado do circuito"
            subtitle="Probabilidades dos estados computacionais — não são chances de sucesso de uma coleta."
          />
          <Card>
            <View className="mb-4 flex-row gap-3">
              {result.candidates.map((c) => (
                <View key={c.label} className="flex-1">
                  <Text className="text-xs font-bold text-forest">
                    VIZINHO {c.label}
                  </Text>
                  <Text className="mt-1 font-semibold text-ink">{c.name}</Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    {c.quantity} kg estimados
                  </Text>
                </View>
              ))}
            </View>
            {result.states.map((state, i) => (
              <View key={state} className="mb-4">
                <View className="mb-2 flex-row justify-between gap-2">
                  <Text
                    className={`flex-1 text-sm ${state === result.bestState ? "font-bold text-forest" : "text-slate-500"}`}
                  >
                    {state} · {STATE_LABELS[state]}
                  </Text>
                  <Text className="text-sm font-bold text-ink">
                    {(result.probabilities[i] * 100).toFixed(2)}%
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <View
                    className={`h-2 rounded-full ${state === result.bestState ? "bg-forest" : "bg-lime"}`}
                    style={{
                      width: `${Math.max(0, Math.min(100, result.probabilities[i] * 100))}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
          <Card>
            <Badge text={`Estado mais provável: ${result.bestState}`} />
            <Text className="mt-4 text-xl font-bold text-forest">
              {result.decision}
            </Text>
            {result.visitOrder.length ? (
              <Text className="mt-3 text-sm leading-6 text-slate-500">
                Sugestão:{" "}
                {result.visitOrder
                  .map(
                    (label) =>
                      result.candidates.find((c) => c.label === label)?.name ||
                      label,
                  )
                  .join(" → ")}
              </Text>
            ) : (
              <Text className="mt-3 text-sm leading-6 text-slate-500">
                O modelo não selecionou visita. Isso não significa que você deva
                ignorar os pedidos.
              </Text>
            )}
            <Text className="mt-3 text-xs leading-5 text-slate-500">
              Referência: {result.inputs.referenceKg} kg. Ângulos: A ={" "}
              {result.angles.A.toFixed(4)} rad; B = {result.angles.B.toFixed(4)}{" "}
              rad.
            </Text>
          </Card>
        </View>
      )}
      <Card>
        <Text className="font-bold text-ink">Um experimento acadêmico</Text>
        <Text className="mt-2 text-sm leading-6 text-slate-500">
          Executado no simulador default.qubit, sem hardware quântico. Este
          circuito seleciona candidatos, mas não calcula o menor percurso nem
          comprova vantagem quântica. No estado 11, a ordem é uma regra clássica
          por urgência. Nenhum pedido é aceito, alterado ou cancelado
          automaticamente.
        </Text>
      </Card>
      <Card>
        <Text className="mb-2 font-bold text-ink">Projeto do grupo</Text>
        <Text className="text-sm leading-6 text-slate-500">
          Daniel Pereira Rodrigues de Lima{"\n"}Giulia Caroline Claro{"\n"}João
          Victor da Silva Jardim
        </Text>
      </Card>
      <Button
        title="Voltar às coletas"
        secondary
        onPress={() => navigation.goBack()}
      />
    </Page>
  );
}

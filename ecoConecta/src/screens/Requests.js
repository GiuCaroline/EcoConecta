import { Feedback } from "../utils/feedback";
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../context/AppContext";
import { MATERIALS, STEPS } from "../data/mock";
import {
  acceptsMaterials,
  canAdvance,
  materialNames,
  parseDate,
  parseQuantity,
} from "../utils/domain";
import {
  Page,
  Heading,
  Card,
  Button,
  Field,
  Chip,
  MaterialPicker,
  Empty,
  RequestCard,
  Row,
  Icon,
  Badge,
} from "../components/UI";

export function NewRequest({ navigation, route }) {
  const { user, points, addRequest } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    materials: [],
    quantity: "",
    pointId: route.params?.pointId || "",
    address: user.address || "",
    date: "",
    period: "Manhã · 08h–12h",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const change = (key) => (value) => setForm((s) => ({ ...s, [key]: value }));
  const eligible = points.filter((p) => acceptsMaterials(p, form.materials));
  const point = points.find((p) => p.id === form.pointId);
  function validate() {
    const next = {};
    if (step === 0 || step === 2) {
      if (!form.materials.length)
        next.materials = "Selecione pelo menos um material.";
      if (!parseQuantity(form.quantity))
        next.quantity = "Informe um peso estimado maior que zero, em kg.";
      if (!point || !acceptsMaterials(point, form.materials))
        next.pointId =
          "Selecione um ponto que receba todos os materiais escolhidos.";
    }
    if (step === 1 || step === 2) {
      if (form.address.trim().length < 10)
        next.address = "Informe rua, número, bairro e cidade.";
      if (!parseDate(form.date))
        next.date = "Use DD/MM/AAAA, com uma data válida de hoje em diante.";
    }
    setErrors(next);
    return !Object.keys(next).length;
  }
  function next() {
    if (validate()) setStep((s) => s + 1);
  }
  function submit() {
    if (!validate()) {
      Feedback.alert(
        "Revise sua coleta",
        "Há dados inválidos. Volte às etapas anteriores para corrigir.",
      );
      return;
    }
    const id = addRequest({
      ...form,
      quantity: parseQuantity(form.quantity),
      address: form.address.trim(),
    });
    navigation.replace("RequestDetail", { id });
  }
  return (
    <Page>
      <Heading
        eyebrow={`ETAPA ${step + 1} DE 3`}
        title={
          [
            "O que vamos coletar?",
            "Quando e onde?",
            "Tudo certo para começar?",
          ][step]
        }
        subtitle={
          [
            "Escolha os materiais e um ponto compatível.",
            "Informe os dados para a retirada.",
            "Confira seu pedido antes de confirmar.",
          ][step]
        }
      />
      <View className="mb-6 flex-row gap-2">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-forest" : "bg-slate-200"}`}
          />
        ))}
      </View>
      {step === 0 && (
        <>
          <MaterialPicker
            value={form.materials}
            onChange={change("materials")}
          />
          {errors.materials && (
            <Text className="mb-4 text-sm text-red-600">
              {errors.materials}
            </Text>
          )}
          <Field
            label="Peso total estimado (kg)"
            placeholder="Ex.: 4,5"
            keyboardType="decimal-pad"
            value={form.quantity}
            onChangeText={change("quantity")}
            error={errors.quantity}
          />
          <Text className="mb-3 text-lg font-bold text-ink">
            Ponto de destino
          </Text>
          <Text className="mb-3 text-sm leading-5 text-slate-500">
            A lista mostra os pontos que recebem todos os materiais
            selecionados.
          </Text>
          {eligible.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: form.pointId === p.id }}
              onPress={() => change("pointId")(p.id)}
              className={`mb-3 flex-row items-center gap-3 rounded-2xl border p-4 ${form.pointId === p.id ? "border-forest bg-mint" : "border-slate-200 bg-white"}`}
            >
              <Icon
                name={
                  form.pointId === p.id ? "radio-button-on" : "radio-button-off"
                }
              />
              <View className="flex-1">
                <Text className="font-bold text-ink">{p.name}</Text>
                <Text className="mt-1 text-xs text-slate-500">{p.address}</Text>
              </View>
            </Pressable>
          ))}
          {!eligible.length && (
            <Empty
              title="Nenhum ponto compatível"
              body="Divida os materiais em pedidos separados ou cadastre um ponto que receba esta combinação."
            />
          )}
          {errors.pointId && (
            <Text className="mb-3 text-sm text-red-600">{errors.pointId}</Text>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <Field
            label="Endereço da coleta"
            placeholder="Rua, número, complemento, bairro e cidade"
            value={form.address}
            onChangeText={change("address")}
            error={errors.address}
            multiline
          />
          <Field
            label="Data desejada"
            placeholder="DD/MM/AAAA"
            value={form.date}
            onChangeText={change("date")}
            error={errors.date}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <Text className="mb-3 font-semibold text-ink">Período</Text>
          <View className="mb-3 flex-row flex-wrap">
            {["Manhã · 08h–12h", "Tarde · 13h–18h"].map((p) => (
              <Chip
                key={p}
                label={p}
                selected={form.period === p}
                onPress={() => change("period")(p)}
              />
            ))}
          </View>
          <Field
            label="Observações (opcional)"
            placeholder="Ex.: Interfone 12, caixas na portaria..."
            value={form.notes}
            onChangeText={change("notes")}
            multiline
          />
          <Card>
            <Text className="text-sm leading-5 text-slate-500">
              A data é uma preferência. Neste protótipo não há confirmação real
              de disponibilidade do motorista.
            </Text>
          </Card>
        </>
      )}
      {step === 2 && (
        <>
          <Card>
            <Row
              icon="repeat-outline"
              title="Materiais"
              body={`${materialNames(form.materials, MATERIALS)}\n${form.quantity} kg estimados`}
            />
            <Row
              icon="business-outline"
              title="Destino"
              body={point?.name || "Selecione outro ponto"}
            />
            <Row icon="location-outline" title="Retirada" body={form.address} />
            <Row
              icon="calendar-outline"
              title="Agendamento desejado"
              body={`${form.date} · ${form.period}`}
            />
            {form.notes ? (
              <Row
                icon="chatbox-outline"
                title="Observações"
                body={form.notes}
              />
            ) : null}
          </Card>
          <Card>
            <Text className="font-bold text-forest">
              Um material, muitas possibilidades.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-slate-500">
              Separe os recicláveis e deixe-os prontos para a retirada. Este
              pedido será apenas uma simulação local.
            </Text>
          </Card>
        </>
      )}
      <Button
        title={step < 2 ? "Continuar" : "Confirmar coleta"}
        onPress={step < 2 ? next : submit}
        disabled={step === 0 && !eligible.length}
        icon={step === 2 ? "checkmark-circle-outline" : "arrow-forward"}
      />
      {step > 0 && (
        <Button
          title="Voltar etapa"
          secondary
          onPress={() => {
            setErrors({});
            setStep((s) => s - 1);
          }}
        />
      )}
    </Page>
  );
}
export function Requests({ navigation }) {
  const { user, requests, ownedPoints } = useApp();
  const [filter, setFilter] = useState("active");
  const visible = requests.filter((r) =>
    user.role === "resident"
      ? r.residentId === user.id
      : user.role === "driver"
        ? r.driverId === user.id
        : ownedPoints.some((p) => p.id === r.pointId),
  );
  const filtered = visible.filter((r) =>
    filter === "active"
      ? !r.cancelled && r.status < 4
      : filter === "done"
        ? !r.cancelled && r.status === 4
        : r.cancelled,
  );
  return (
    <Page>
      <Heading
        title={user.role === "point" ? "Coletas do ponto" : "Suas coletas"}
        subtitle="Cada pedido é um passo para um novo ciclo."
      />
      <View className="mb-4 flex-row flex-wrap">
        {[
          ["active", "Em andamento"],
          ["done", "Concluídas"],
          ["cancelled", "Canceladas"],
        ].map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={filter === id}
            onPress={() => setFilter(id)}
          />
        ))}
      </View>
      {filtered.length ? (
        filtered.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onPress={() => navigation.navigate("RequestDetail", { id: r.id })}
          />
        ))
      ) : (
        <Empty
          title="Nenhuma coleta nesta lista"
          body={
            user.role === "resident"
              ? "Agende sua primeira coleta e acompanhe por aqui."
              : "Os pedidos vinculados a você aparecerão aqui."
          }
        />
      )}
      {user.role === "resident" && (
        <Button
          title="Agendar nova coleta"
          icon="add"
          onPress={() => navigation.navigate("NewRequest", {})}
        />
      )}
    </Page>
  );
}
export function RequestDetail({ navigation, route }) {
  const {
    requests,
    points,
    user,
    ownedPoints,
    acceptRequest,
    advanceRequest,
    cancelRequest,
  } = useApp();
  const request = requests.find((r) => r.id === route.params.id);
  if (!request)
    return (
      <Page>
        <Empty title="Coleta não encontrada" body="Volte à lista de pedidos." />
      </Page>
    );
  const point = points.find((p) => p.id === request.pointId);
  const allowed = canAdvance(
    request,
    user.role,
    user.id,
    ownedPoints.map((p) => p.id),
  );
  const confirmCancel = () =>
    Feedback.alert(
      "Cancelar coleta?",
      "O pedido deixará de aparecer para os motoristas.",
      [
        { text: "Manter", style: "cancel" },
        {
          text: "Cancelar coleta",
          style: "destructive",
          onPress: () => cancelRequest(request.id),
        },
      ],
    );
  const nextLabel =
    request.status === 1
      ? "Confirmar retirada do material"
      : request.status === 2
        ? "Confirmar entrega ao ponto"
        : "Confirmar recebimento";
  return (
    <Page>
      <Heading
        eyebrow={request.id}
        title={request.cancelled ? "Coleta cancelada" : STEPS[request.status]}
        subtitle="Acompanhe o caminho do seu material."
      />
      <Card>
        <Text className="text-xs leading-5 text-slate-500">
          Acompanhamento simulado. Os perfis atualizam as etapas manualmente;
          não há mapa ou rastreamento GPS.
        </Text>
      </Card>
      {!request.cancelled && (
        <Card>
          {STEPS.map((label, i) => (
            <View key={label} className="flex-row gap-3">
              <View className="items-center">
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${i <= request.status ? "bg-forest" : "bg-slate-100"}`}
                >
                  <Icon
                    name={
                      i < request.status || request.status === 4
                        ? "checkmark"
                        : i === request.status
                          ? "ellipse"
                          : "ellipse-outline"
                    }
                    color={i <= request.status ? "white" : "#94a3b8"}
                    size={16}
                  />
                </View>
                {i < 4 && (
                  <View
                    className={`my-1 h-7 w-0.5 ${i < request.status ? "bg-forest" : "bg-slate-200"}`}
                  />
                )}
              </View>
              <Text
                className={`flex-1 pt-1.5 text-sm ${i <= request.status ? "font-bold text-forest" : "text-slate-400"}`}
              >
                {label}
              </Text>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Row
          icon="repeat-outline"
          title="Materiais"
          body={`${materialNames(request.materials, MATERIALS)} · ${request.quantity} kg estimados`}
        />
        <Row
          icon="location-outline"
          title={`Retirada · ${request.residentName}`}
          body={request.address}
        />
        <Row
          icon="business-outline"
          title="Destino"
          body={
            point ? `${point.name}\n${point.address}` : "Ponto indisponível"
          }
        />
        <Row
          icon="calendar-outline"
          title="Agendamento desejado"
          body={`${request.date} · ${request.period}`}
        />
        <Row
          icon="car-outline"
          title="Motorista parceiro"
          body={request.driverName || "Aguardando um parceiro aceitar"}
        />
        {request.notes ? (
          <Row
            icon="chatbox-outline"
            title="Observações"
            body={request.notes}
          />
        ) : null}
      </Card>
      {user.role === "driver" && request.status === 0 && !request.cancelled && (
        <Button
          title="Aceitar esta coleta"
          disabled={user.online === false}
          icon="checkmark-circle-outline"
          onPress={() => acceptRequest(request.id)}
        />
      )}
      {allowed && (
        <Button
          title={nextLabel}
          icon="checkmark-circle-outline"
          onPress={() =>
            Feedback.alert(
              nextLabel,
              "Confirme para atualizar a etapa no protótipo.",
              [
                { text: "Voltar", style: "cancel" },
                {
                  text: "Confirmar",
                  onPress: () => advanceRequest(request.id),
                },
              ],
            )
          }
        />
      )}
      {request.status === 3 && user.role !== "point" && (
        <Card>
          <Text className="text-sm leading-5 text-slate-500">
            Entrega registrada. O ponto de reciclagem precisa confirmar o
            recebimento para concluir.
          </Text>
        </Card>
      )}
      {request.status === 0 &&
        !request.cancelled &&
        request.residentId === user.id &&
        user.role === "resident" && (
          <Button title="Cancelar coleta" secondary onPress={confirmCancel} />
        )}
      {request.status === 4 && !request.cancelled && (
        <Card>
          <Badge text="Ciclo concluído" />
          <Text className="mt-3 text-lg font-bold text-forest">
            Seu material ganhou um novo destino 💚
          </Text>
          <Text className="mt-2 text-sm leading-5 text-slate-500">
            Peso informado: {request.quantity} kg estimados. O protótipo não
            calcula impacto ambiental certificado.
          </Text>
        </Card>
      )}
      <Button
        title="Ver ponto de destino"
        secondary
        onPress={() =>
          navigation.navigate("PointDetail", { id: request.pointId })
        }
      />
    </Page>
  );
}

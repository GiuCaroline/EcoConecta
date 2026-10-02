import { Feedback } from "../utils/feedback";
import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { MATERIALS } from "../data/mock";
import { materialNames } from "../utils/domain";
import {
  Page,
  Heading,
  Field,
  Chip,
  PointCard,
  Card,
  Row,
  Button,
  Badge,
  Empty,
  MaterialPicker,
  Icon,
} from "../components/UI";

export function Points({ navigation, route }) {
  const { points, favorites } = useApp();
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  useEffect(() => {
    if (route.params?.material) setMaterial(route.params.material);
  }, [route.params?.material]);
  const normalized = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = points.filter(
    (p) =>
      `${p.name} ${p.address}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized) &&
      (material === "all" || p.materials.includes(material)) &&
      (!onlyFavorites || favorites.includes(p.id)),
  );
  return (
    <Page>
      <Heading
        title="Encontre um novo destino"
        subtitle="Explore os pontos e os materiais que cada um recebe."
      />
      <Field
        label="Buscar ponto ou bairro"
        placeholder="Ex.: Mauá, cooperativa..."
        value={search}
        onChangeText={setSearch}
      />
      <View className="flex-row flex-wrap">
        <Chip
          label="Todos"
          selected={material === "all"}
          onPress={() => setMaterial("all")}
        />
        {MATERIALS.map((m) => (
          <Chip
            key={m.id}
            label={m.name}
            selected={material === m.id}
            onPress={() => setMaterial(m.id)}
          />
        ))}
      </View>
      <View className="my-3 flex-row items-center justify-between">
        <Text className="text-sm text-slate-500">
          {filtered.length} ponto(s) encontrado(s)
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-ink">Favoritos</Text>
          <Switch
            accessibilityLabel="Mostrar apenas favoritos"
            value={onlyFavorites}
            onValueChange={setOnlyFavorites}
            trackColor={{ false: "#cbd5e1", true: "#166534" }}
          />
        </View>
      </View>
      <Card>
        <Text className="text-xs leading-5 text-slate-500">
          Os pontos iniciais são fictícios. A busca funciona por nome, endereço
          e material; não usa GPS.
        </Text>
      </Card>
      {filtered.length ? (
        filtered.map((p) => (
          <PointCard
            key={p.id}
            point={p}
            onPress={() => navigation.navigate("PointDetail", { id: p.id })}
          />
        ))
      ) : (
        <Empty
          title="Nenhum ponto por aqui"
          body="Tente outro nome, material ou desative o filtro de favoritos."
          action="Limpar filtros"
          onPress={() => {
            setSearch("");
            setMaterial("all");
            setOnlyFavorites(false);
          }}
        />
      )}
    </Page>
  );
}
export function PointDetail({ navigation, route }) {
  const { points, user, ownedPoints } = useApp();
  const point = points.find((p) => p.id === route.params.id);
  if (!point)
    return (
      <Page>
        <Empty
          title="Ponto não encontrado"
          body="Volte para a lista para selecionar outro ponto."
        />
      </Page>
    );
  return (
    <Page>
      <View className="mb-5 h-36 items-center justify-center rounded-3xl bg-mint">
        <Icon name={point.icon} size={70} />
      </View>
      <Heading
        eyebrow="Ponto de reciclagem"
        title={point.name}
        subtitle={point.description}
      />
      <Badge
        text={
          point.active
            ? "Recebendo solicitações"
            : "Novas solicitações pausadas"
        }
        muted={!point.active}
      />
      <View className="mt-5">
        <Card>
          <Row icon="location-outline" title="Onde fica" body={point.address} />
          <Row icon="time-outline" title="Funcionamento" body={point.hours} />
          <Row
            icon="call-outline"
            title="Contato informado"
            body={point.phone}
          />
          <Row
            icon="repeat-outline"
            title="Materiais aceitos"
            body={materialNames(point.materials, MATERIALS)}
          />
        </Card>
      </View>
      {user.role === "resident" && (
        <Button
          title="Agendar coleta para este ponto"
          disabled={!point.active}
          icon="bicycle-outline"
          onPress={() =>
            navigation.navigate("NewRequest", { pointId: point.id })
          }
        />
      )}
      {user.role === "point" && ownedPoints.some((p) => p.id === point.id) && (
        <Button
          title="Editar meu ponto"
          icon="create-outline"
          onPress={() => navigation.navigate("PointForm", { id: point.id })}
        />
      )}
      <Button
        title="Ver dicas de separação"
        secondary
        onPress={() => navigation.navigate("Guide")}
      />
    </Page>
  );
}
export function PointForm({ route, navigation }) {
  const { points, savePoint, ownedPoints } = useApp();
  const id = route.params?.id;
  const existing = points.find((p) => p.id === id);
  const [form, setForm] = useState(
    existing || {
      name: "",
      address: "",
      phone: "",
      hours: "",
      description: "",
      materials: [],
      active: true,
    },
  );
  const [errors, setErrors] = useState({});
  const change = (key) => (value) => setForm((s) => ({ ...s, [key]: value }));
  if (id && !ownedPoints.some((p) => p.id === id))
    return (
      <Page>
        <Empty
          title="Edição indisponível"
          body="Você pode editar apenas seus próprios pontos."
        />
      </Page>
    );
  function submit() {
    const next = {};
    ["name", "address", "hours", "description"].forEach((key) => {
      if (!form[key]?.trim()) next[key] = "Preencha este campo.";
    });
    if (form.phone.replace(/\D/g, "").length < 10)
      next.phone = "Informe um telefone com DDD.";
    if (!form.materials.length)
      next.materials = "Selecione pelo menos um material.";
    setErrors(next);
    if (Object.keys(next).length) return;
    savePoint(
      { ...form, name: form.name.trim(), address: form.address.trim() },
      id,
    );
    Feedback.alert(
      id ? "Ponto atualizado" : "Ponto cadastrado",
      "As informações já estão disponíveis na busca.",
    );
    navigation.goBack();
  }
  return (
    <Page>
      <Heading
        title={id ? "Edite seu ponto" : "Abra as portas para um novo ciclo"}
        subtitle="Informe os dados do local que receberá os materiais."
      />
      <Field
        label="Nome do ponto"
        placeholder="Ex.: Cooperativa Novo Ciclo"
        value={form.name}
        onChangeText={change("name")}
        error={errors.name}
      />
      <Field
        label="Endereço completo"
        placeholder="Rua, número, bairro e cidade"
        value={form.address}
        onChangeText={change("address")}
        error={errors.address}
      />
      <Field
        label="Telefone"
        placeholder="(11) 99999-9999"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={change("phone")}
        error={errors.phone}
      />
      <Field
        label="Horários de atendimento"
        placeholder="Seg a sex, 08h às 17h"
        value={form.hours}
        onChangeText={change("hours")}
        error={errors.hours}
      />
      <Field
        label="Sobre o ponto"
        multiline
        placeholder="Conte como o local recebe e encaminha os materiais."
        value={form.description}
        onChangeText={change("description")}
        error={errors.description}
      />
      <Text className="mb-3 font-semibold text-ink">Materiais aceitos</Text>
      <MaterialPicker value={form.materials} onChange={change("materials")} />
      {errors.materials && (
        <Text className="mb-3 text-sm text-red-600">{errors.materials}</Text>
      )}
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-bold text-ink">
              Receber novas solicitações
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Pausar mantém os pedidos existentes.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Receber novas solicitações"
            value={form.active}
            onValueChange={change("active")}
            trackColor={{ false: "#cbd5e1", true: "#166534" }}
          />
        </View>
      </Card>
      <Button
        title={id ? "Salvar alterações" : "Cadastrar ponto"}
        icon="checkmark-circle-outline"
        onPress={submit}
      />
    </Page>
  );
}

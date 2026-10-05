import React from "react";
import { useAction } from "../hooks/useAction";
import { View, Text, Pressable, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { MATERIALS } from "../data/catalog";
import {
  Page,
  Heading,
  Card,
  Button,
  Icon,
  PointCard,
  RequestCard,
  Empty,
  Row,
} from "../components/UI";

export function Home({ navigation }) {
  const { user, points, requests, notifications } = useApp();
  const completed = requests.filter(
    (r) => r.residentId === user.id && r.status === 4 && !r.cancelled,
  );
  const active = requests.find(
    (r) => r.residentId === user.id && r.status < 4 && !r.cancelled,
  );
  return (
    <Page>
      <View className="mb-6 flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Seu endereço de coleta
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("EditProfile")}
            className="mt-2 flex-row items-center gap-1"
          >
            <Icon name="location" size={16} />
            <Text numberOfLines={1} className="flex-1 font-bold text-ink">
              {user.address || "Adicionar endereço"}
            </Text>
            <Icon name="chevron-down" size={16} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => navigation.navigate("Notifications")}
          accessibilityRole="button"
          accessibilityLabel="Notificações"
          className="h-12 w-12 items-center justify-center rounded-2xl bg-white"
        >
          <Icon name="notifications-outline" />
          {notifications.some((n) => !n.read) && (
            <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500" />
          )}
        </Pressable>
      </View>
      <Heading
        title={`Olá, ${user.name.split(" ")[0]} 👋`}
        subtitle="O que vamos transformar hoje?"
      />
      <View className="mb-6 overflow-hidden rounded-3xl bg-forest p-6">
        <View className="mb-3 flex-row items-center gap-2">
          <Icon name="sparkles-outline" color="#c4f17b" size={18} />
          <Text className="text-xs font-bold uppercase tracking-widest text-lime">
            Pequenas ações, novos ciclos
          </Text>
        </View>
        <Text className="text-3xl font-bold leading-9 text-white">
          Sua reciclagem,{"\n"}sem sair de casa.
        </Text>
        <Text className="mb-5 mt-3 leading-6 text-green-100">
          Conectamos você a quem coleta e a quem transforma.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("NewRequest", {})}
          className="flex-row items-center justify-between rounded-2xl bg-lime p-4"
        >
          <Text className="font-bold text-forest">Agendar minha coleta</Text>
          <Icon name="arrow-forward" />
        </Pressable>
      </View>
      <Text className="mb-3 text-lg font-bold text-ink">
        O que você quer reciclar?
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        {MATERIALS.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            onPress={() => navigation.navigate("Points", { material: m.id })}
            className="w-1/3 p-1"
          >
            <View className="items-center rounded-2xl border border-slate-100 bg-white px-1 py-4">
              <Icon name={m.icon} size={27} />
              <Text className="mt-2 text-xs font-semibold text-ink">
                {m.name}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      {active && (
        <>
          <Text className="mb-3 text-lg font-bold text-ink">
            Sua coleta em andamento
          </Text>
          <RequestCard
            request={active}
            onPress={() =>
              navigation.navigate("RequestDetail", { id: active.id })
            }
          />
        </>
      )}
      <View className="mb-4 flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-2xl font-bold text-forest">
            {completed.reduce((sum, r) => sum + r.quantity, 0)} kg
          </Text>
          <Text className="mt-1 text-xs text-slate-500">
            Peso estimado entregue
          </Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-2xl font-bold text-forest">
            {completed.length}
          </Text>
          <Text className="mt-1 text-xs text-slate-500">
            Coletas concluídas
          </Text>
        </Card>
      </View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-ink">Explore os pontos</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Points", { material: "all" })}
        >
          <Text className="font-bold text-forest">Ver todos</Text>
        </Pressable>
      </View>
      {points
        .filter((p) => p.active)
        .slice(0, 2)
        .map((p) => (
          <PointCard
            key={p.id}
            point={p}
            onPress={() => navigation.navigate("PointDetail", { id: p.id })}
          />
        ))}
      {!points.some((p) => p.active) && (
        <Empty
          title="Ainda não há pontos disponíveis"
          body="Um responsável precisa cadastrar um ponto para receber os materiais."
        />
      )}
      <Button
        title="Como preparar seus materiais"
        secondary
        icon="information-circle-outline"
        onPress={() => navigation.navigate("Guide")}
      />
    </Page>
  );
}
export function DriverHome({ navigation }) {
  const { user, requests, updateUser } = useApp();
  const { busy, run } = useAction("Disponibilidade");
  const jobs = requests.filter(
    (r) =>
      r.driverId === user.id && r.status > 0 && r.status < 4 && !r.cancelled,
  );
  const available = requests.filter((r) => r.status === 0 && !r.cancelled);
  const completed = requests.filter(
    (r) => r.driverId === user.id && r.status === 4 && !r.cancelled,
  );
  return (
    <Page>
      <Heading
        eyebrow="Área do motorista"
        title="Vamos fazer a diferença?"
        subtitle={`Olá, ${user.name}. Suas próximas coletas estão aqui.`}
      />
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">
              {user.online === false
                ? "Você está offline"
                : "Disponível para coletas"}
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Ative para aceitar novas solicitações de coleta.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Disponível para coletas"
            value={user.online !== false}
            disabled={busy}
            onValueChange={(online) => run(() => updateUser({ online }))}
            trackColor={{ false: "#cbd5e1", true: "#166534" }}
          />
        </View>
      </Card>
      <View className="flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-3xl font-bold text-forest">
            {completed.length}
          </Text>
          <Text className="text-xs text-slate-500">Entregas confirmadas</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-3xl font-bold text-forest">
            {available.length}
          </Text>
          <Text className="text-xs text-slate-500">Pedidos disponíveis</Text>
        </Card>
      </View>
      <Button
        title="Sugestão quântica de coletas"
        icon="hardware-chip-outline"
        onPress={() => navigation.navigate("Quantum")}
      />
      <Text className="mb-3 text-lg font-bold text-ink">Minha rota</Text>
      {jobs.length ? (
        jobs.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onPress={() => navigation.navigate("RequestDetail", { id: r.id })}
          />
        ))
      ) : (
        <Empty
          title="Nenhuma coleta na rota"
          body="Aceite um pedido abaixo para iniciar."
        />
      )}
      <Text className="mb-3 text-lg font-bold text-ink">
        Pedidos para aceitar
      </Text>
      {user.online === false ? (
        <Empty
          title="Você está offline"
          body="Ative a disponibilidade para aceitar novos pedidos."
        />
      ) : available.length ? (
        available.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onPress={() => navigation.navigate("RequestDetail", { id: r.id })}
          />
        ))
      ) : (
        <Empty title="Tudo em dia" body="Novos pedidos aparecerão aqui." />
      )}
    </Page>
  );
}
export function PointHome({ navigation }) {
  const { ownedPoints, requests } = useApp();
  const ids = ownedPoints.map((p) => p.id);
  const pending = requests.filter(
    (r) => ids.includes(r.pointId) && r.status === 3 && !r.cancelled,
  );
  const incoming = requests.filter(
    (r) => ids.includes(r.pointId) && r.status < 3 && !r.cancelled,
  );
  return (
    <Page>
      <Heading
        eyebrow="Área do ponto de reciclagem"
        title="Receber. Separar. Transformar."
        subtitle="Gerencie seus pontos e confirme o recebimento dos materiais."
      />
      <Button
        title="Cadastrar ponto de reciclagem"
        icon="add-circle-outline"
        onPress={() => navigation.navigate("PointForm", {})}
      />
      <View className="mt-5 flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-3xl font-bold text-forest">
            {ownedPoints.length}
          </Text>
          <Text className="text-xs text-slate-500">Pontos cadastrados</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-3xl font-bold text-forest">
            {incoming.length}
          </Text>
          <Text className="text-xs text-slate-500">Coletas previstas</Text>
        </Card>
      </View>
      <Text className="mb-3 text-lg font-bold text-ink">
        Confirmar recebimentos
      </Text>
      {pending.length ? (
        pending.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onPress={() => navigation.navigate("RequestDetail", { id: r.id })}
          />
        ))
      ) : (
        <Empty
          title="Nenhum recebimento pendente"
          body="Quando um motorista marcar a entrega, você poderá confirmá-la aqui."
        />
      )}
      <Text className="mb-3 text-lg font-bold text-ink">Meus pontos</Text>
      {ownedPoints.length ? (
        ownedPoints.map((p) => (
          <Card key={p.id}>
            <Row
              icon="business-outline"
              title={p.name}
              body={`${p.address}\n${p.active ? "Recebendo materiais" : "Pausado"}`}
            />
            <Button
              title="Editar ponto"
              secondary
              onPress={() => navigation.navigate("PointForm", { id: p.id })}
            />
          </Card>
        ))
      ) : (
        <Empty
          title="Cadastre seu primeiro ponto"
          body="Informe endereço, horários e materiais aceitos."
        />
      )}
    </Page>
  );
}

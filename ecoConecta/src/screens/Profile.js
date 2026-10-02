import { Feedback } from "../utils/feedback";
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../context/AppContext";
import { MATERIALS, ROLES } from "../data/mock";
import {
  Page,
  Heading,
  Card,
  Row,
  Icon,
  Button,
  Field,
  Empty,
} from "../components/UI";

export function Profile({ navigation }) {
  const { user, updateUser, logout, reset } = useApp();
  const items = [
    ["person-outline", "Editar meu perfil", "EditProfile"],
    ["notifications-outline", "Notificações", "Notifications"],
    ["book-outline", "Guia de reciclagem", "Guide"],
    ["help-circle-outline", "Ajuda e sobre", "Help"],
  ];
  return (
    <Page>
      <View className="mb-6 items-center">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-mint">
          <Text className="text-3xl font-bold text-forest">
            {user.name[0]?.toUpperCase()}
          </Text>
        </View>
        <Text className="text-2xl font-bold text-ink">{user.name}</Text>
        <Text className="mt-1 text-sm text-slate-500">{user.email}</Text>
      </View>
      <Card>
        <Text className="mb-1 text-lg font-bold text-ink">
          Trocar perfil de demonstração
        </Text>
        <Text className="mb-4 text-sm leading-5 text-slate-500">
          Teste o ciclo completo no mesmo aparelho. A identidade permanece a
          mesma para visualizar seus pedidos.
        </Text>
        {ROLES.map((r) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: user.role === r.id }}
            key={r.id}
            onPress={() => updateUser({ role: r.id })}
            className={`mb-2 flex-row items-center gap-3 rounded-2xl border p-3 ${user.role === r.id ? "border-forest bg-mint" : "border-slate-100"}`}
          >
            <Icon name={r.icon} />
            <View className="flex-1">
              <Text className="font-bold text-ink">{r.name}</Text>
              <Text className="mt-1 text-xs text-slate-500">
                {r.description}
              </Text>
            </View>
            <Icon
              name={user.role === r.id ? "radio-button-on" : "radio-button-off"}
            />
          </Pressable>
        ))}
      </Card>
      <Card>
        {items.map(([icon, label, screen]) => (
          <Pressable
            key={screen}
            accessibilityRole="button"
            onPress={() => navigation.navigate(screen)}
            className="flex-row items-center gap-3 border-b border-slate-100 py-4"
          >
            <Icon name={icon} />
            <Text className="flex-1 font-semibold text-ink">{label}</Text>
            <Icon name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </Card>
      <Button
        title="Sair do perfil"
        secondary
        icon="log-out-outline"
        onPress={logout}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Feedback.alert(
            "Restaurar demonstração?",
            "Isso remove os pedidos, pontos e perfis locais e restaura os exemplos iniciais.",
            [
              { text: "Manter dados", style: "cancel" },
              { text: "Restaurar", style: "destructive", onPress: reset },
            ],
          )
        }
        className="p-4"
      >
        <Text className="text-center text-sm font-semibold text-slate-500">
          Restaurar dados de exemplo
        </Text>
      </Pressable>
      <Text className="mt-4 text-center text-xs text-slate-400">
        EcoConecta · Frontend demonstrativo · v1.0
      </Text>
    </Page>
  );
}
export function EditProfile({ navigation }) {
  const { user, updateUser } = useApp();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
    address: user.address || "",
    vehicle: user.vehicle || "",
    plate: user.plate || "",
  });
  const [errors, setErrors] = useState({});
  const change = (key) => (value) => setForm((s) => ({ ...s, [key]: value }));
  function submit() {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Informe seu nome.";
    if (form.phone && form.phone.replace(/\D/g, "").length < 10)
      next.phone = "Informe um telefone com DDD.";
    setErrors(next);
    if (Object.keys(next).length) return;
    updateUser({ ...form, name: form.name.trim() });
    navigation.goBack();
  }
  return (
    <Page>
      <Heading
        title="Seu perfil"
        subtitle="Deixe seus dados de demonstração atualizados."
      />
      <Field
        label="Nome"
        value={form.name}
        onChangeText={change("name")}
        error={errors.name}
      />
      <Field
        label="Telefone (opcional)"
        value={form.phone}
        onChangeText={change("phone")}
        keyboardType="phone-pad"
        error={errors.phone}
      />
      <Field
        label="Endereço de coleta (opcional)"
        value={form.address}
        onChangeText={change("address")}
        multiline
        placeholder="Rua, número, bairro e cidade"
      />
      {user.role === "driver" && (
        <>
          <Field
            label="Veículo (opcional)"
            placeholder="Ex.: Fiorino branca"
            value={form.vehicle}
            onChangeText={change("vehicle")}
          />
          <Field
            label="Placa de demonstração (opcional)"
            placeholder="ABC1D23"
            value={form.plate}
            onChangeText={change("plate")}
            autoCapitalize="characters"
          />
        </>
      )}
      <Button title="Salvar perfil" onPress={submit} icon="checkmark" />
    </Page>
  );
}
export function Notifications() {
  const { notifications, markRead } = useApp();
  return (
    <Page>
      <Heading
        title="Novidades do seu ciclo"
        subtitle="Atualizações geradas pelas ações neste aparelho."
      />
      {notifications.length ? (
        <>
          <Button
            title="Marcar todas como lidas"
            secondary
            onPress={markRead}
          />
          {notifications.map((n) => (
            <Card key={n.id}>
              <View className="flex-row gap-3">
                <Icon
                  name={n.read ? "mail-open-outline" : "mail-unread-outline"}
                />
                <View className="flex-1">
                  <Text className="font-bold text-ink">{n.title}</Text>
                  <Text className="mt-2 text-sm leading-5 text-slate-500">
                    {n.body}
                  </Text>
                  {!n.read && (
                    <Text className="mt-2 text-xs font-bold text-forest">
                      NOVA
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : (
        <Empty
          title="Nenhuma novidade ainda"
          body="Crie uma coleta ou atualize uma etapa para ver as notificações de exemplo."
        />
      )}
    </Page>
  );
}
export function Guide() {
  return (
    <Page>
      <Heading
        eyebrow="RECICLAR COMEÇA NA SEPARAÇÃO"
        title="Prepare seus materiais"
        subtitle="Cada cuidado facilita o próximo passo."
      />
      {MATERIALS.map((m) => (
        <Card key={m.id}>
          <Row icon={m.icon} title={m.name} body={m.tip} />
        </Card>
      ))}
      <Card>
        <Text className="font-bold text-ink">Confirme com o ponto</Text>
        <Text className="mt-2 text-sm leading-6 text-slate-500">
          As regras de recebimento variam. Pilhas, baterias e resíduos perigosos
          exigem destinos específicos; combine previamente com o ponto.
        </Text>
      </Card>
    </Page>
  );
}
export function Help() {
  return (
    <Page>
      <Heading
        title="Um ciclo mais simples"
        subtitle="Entenda como funciona o EcoConecta."
      />
      <Card>
        <Row
          icon="repeat-outline"
          title="1. Separe e solicite"
          body="Selecione os materiais, escolha o ponto e informe a data desejada."
        />
        <Row
          icon="car-outline"
          title="2. O motorista coleta"
          body="O parceiro aceita o pedido, registra a retirada e a entrega ao destino."
        />
        <Row
          icon="business-outline"
          title="3. O ponto recebe"
          body="O responsável confirma o recebimento para concluir a coleta."
        />
      </Card>
      <Card>
        <Text className="text-lg font-bold text-ink">Sobre esta versão</Text>
        <Text className="mt-3 text-sm leading-6 text-slate-500">
          Este aplicativo contém somente frontend. Os pontos, pedidos e perfis
          de exemplo são fictícios. Não há cobrança, coleta real, autenticação,
          mapa, mensagens ou notificação push. Os dados ficam neste aparelho e
          não são sincronizados com outras pessoas.
        </Text>
      </Card>
      <Card>
        <Text className="text-lg font-bold text-ink">
          Teste o ciclo completo
        </Text>
        <Text className="mt-3 text-sm leading-6 text-slate-500">
          Entre pela demonstração. Crie um pedido como usuário. Em Perfil,
          alterne para motorista e aceite a coleta. Registre a retirada e a
          entrega. Alterne para ponto e confirme o recebimento. Volte ao perfil
          de usuário para conferir o histórico.
        </Text>
      </Card>
    </Page>
  );
}

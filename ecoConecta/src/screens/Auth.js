import { Feedback } from "../utils/feedback";
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { ROLES } from "../data/catalog";
import {
  Page,
  Heading,
  Field,
  Button,
  Icon,
  Card,
  Chip,
} from "../components/UI";

export function Welcome({ navigation }) {
  return (
    <SafeAreaView className="flex-1 bg-forest">
      <View className="flex-1 justify-between p-6">
        <View className="mt-8 flex-row items-center gap-2">
          <Icon name="leaf" color="#c4f17b" size={28} />
          <Text className="text-2xl font-bold text-white">
            eco<Text className="text-lime">conecta</Text>
          </Text>
        </View>
        <View>
          <View className="mb-8 h-36 w-36 items-center justify-center rounded-full bg-white/10">
            <Icon name="repeat-outline" color="#c4f17b" size={84} />
          </View>
          <Text className="text-5xl font-bold leading-[56px] text-white">
            Um novo ciclo{"\n"}começa com{"\n"}
            <Text className="text-lime">você.</Text>
          </Text>
          <Text className="mt-5 text-lg leading-7 text-green-100">
            Separe seus materiais. Um parceiro coleta. A reciclagem acontece.
          </Text>
        </View>
        <View>
          <Pressable
            accessibilityRole="button"
            className="mb-3 rounded-2xl bg-lime p-4"
            onPress={() => navigation.navigate("Register")}
          >
            <Text className="text-center text-base font-bold text-forest">
              Começar agora
            </Text>
          </Pressable>
          <Button
            title="Já tenho uma conta"
            secondary
            onPress={() => navigation.navigate("Login")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
export function AuthForm({ navigation, register: registration = false }) {
  const { login, registerAccount } = useApp();
  const [role, setRole] = useState("resident");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const pending = React.useRef(false);
  const change = (key) => (value) => setForm((s) => ({ ...s, [key]: value }));
  async function submit() {
    if (pending.current) return;
    const next = {};
    if (registration && form.name.trim().length < 2)
      next.name = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Informe um e-mail válido.";
    if (registration ? form.password.length < 8 : !form.password)
      next.password = registration
        ? "Use pelo menos 8 caracteres."
        : "Informe sua senha.";
    if (registration && form.phone && form.phone.replace(/\D/g, "").length < 10)
      next.phone = "Informe um telefone com DDD.";
    setErrors(next);
    if (Object.keys(next).length) return;
    pending.current = true;
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      if (registration)
        await registerAccount({
          name: form.name.trim(),
          email,
          password: form.password,
          phone: form.phone.trim(),
          role,
        });
      else await login(email, form.password);
    } catch (error) {
      if (error.fields)
        setErrors(
          Object.fromEntries(
            error.fields.map((field) => [field.path, field.message]),
          ),
        );
      Feedback.alert(
        registration ? "Não foi possível cadastrar" : "Não foi possível entrar",
        error.message,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading
        eyebrow="BEM-VINDO AO ECOCONECTA"
        title={registration ? "Faça parte do ciclo" : "Que bom ter você aqui"}
        subtitle={
          registration
            ? "Escolha como deseja participar."
            : "Entre com o e-mail e a senha da sua conta."
        }
      />
      {registration && (
        <>
          <Card>
            <Text className="text-sm leading-5 text-slate-500">
              O perfil escolhido será vinculado à sua conta. Para participar com
              outro perfil, cadastre outra conta.
            </Text>
          </Card>
          <View className="mb-4 flex-row flex-wrap">
            {ROLES.map((r) => (
              <Chip
                key={r.id}
                label={r.name}
                selected={role === r.id}
                onPress={() => !busy && setRole(r.id)}
                icon={r.icon}
              />
            ))}
          </View>
          <Field
            label="Nome completo"
            placeholder="Como você se chama?"
            value={form.name}
            onChangeText={change("name")}
            error={errors.name}
            autoComplete="name"
            editable={!busy}
            maxLength={120}
          />
        </>
      )}
      <Field
        label="E-mail"
        placeholder="voce@exemplo.com"
        value={form.email}
        onChangeText={change("email")}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
        maxLength={254}
      />
      {registration && (
        <Field
          label="Telefone (opcional)"
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChangeText={change("phone")}
          error={errors.phone}
          keyboardType="phone-pad"
          editable={!busy}
          maxLength={30}
        />
      )}
      <Field
        label="Senha"
        placeholder={registration ? "Pelo menos 8 caracteres" : "Sua senha"}
        value={form.password}
        onChangeText={change("password")}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={registration ? "new-password" : "current-password"}
        editable={!busy}
        maxLength={72}
      />
      <Button
        title={
          busy ? "Aguarde..." : registration ? "Criar minha conta" : "Entrar"
        }
        onPress={submit}
        disabled={busy}
        icon="arrow-forward"
      />
      <Button
        title={registration ? "Já tenho uma conta" : "Criar minha conta"}
        secondary
        disabled={busy}
        onPress={() => navigation.replace(registration ? "Login" : "Register")}
      />
    </Page>
  );
}
export function Login(props) {
  return <AuthForm {...props} />;
}
export function Register(props) {
  return <AuthForm {...props} register />;
}

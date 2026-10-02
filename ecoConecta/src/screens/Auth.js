import { Feedback } from "../utils/feedback";
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { ROLES } from "../data/mock";
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
  const { demo } = useApp();
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
          <Pressable accessibilityRole="button" onPress={demo} className="p-4">
            <Text className="text-center text-sm font-semibold text-white">
              Explorar demonstração →
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
export function AuthForm({ navigation, register = false }) {
  const { login } = useApp();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [role, setRole] = useState("resident");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const change = (key) => (value) => setForm((s) => ({ ...s, [key]: value }));
  function submit() {
    const next = {};
    if (register && form.name.trim().length < 2)
      next.name = "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Informe um e-mail válido.";
    if (form.password.length < 6)
      next.password = "Use pelo menos 6 caracteres para testar o formulário.";
    if (register && form.phone.replace(/\D/g, "").length < 10)
      next.phone = "Informe um telefone com DDD.";
    if (register && !terms)
      next.terms = "Confirme que compreendeu a demonstração.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const email = form.email.trim().toLowerCase();
    login({
      id: `local:${email}`,
      name: register ? form.name.trim() : email.split("@")[0],
      email,
      phone: form.phone.trim(),
      address: "",
      role,
    });
  }
  return (
    <Page>
      <Heading
        eyebrow="BEM-VINDO AO ECOCONECTA"
        title={register ? "Faça parte do ciclo" : "Que bom ter você aqui"}
        subtitle={
          register
            ? "Escolha como deseja participar."
            : "Entre para explorar o protótipo."
        }
      />
      <Card>
        <Text className="text-sm leading-5 text-slate-500">
          Modo demonstrativo: qualquer e-mail válido e senha com 6 caracteres
          permitem entrar. A senha não é salva e não há autenticação real.
        </Text>
      </Card>
      <View className="mb-4 flex-row flex-wrap">
        {ROLES.map((r) => (
          <Chip
            key={r.id}
            label={r.name}
            selected={role === r.id}
            onPress={() => setRole(r.id)}
            icon={r.icon}
          />
        ))}
      </View>
      {register && (
        <Field
          label="Nome completo"
          placeholder="Como você se chama?"
          value={form.name}
          onChangeText={change("name")}
          error={errors.name}
          autoComplete="name"
        />
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
      />
      {register && (
        <Field
          label="Telefone"
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChangeText={change("phone")}
          error={errors.phone}
          keyboardType="phone-pad"
        />
      )}
      <Field
        label="Senha de demonstração"
        placeholder="Pelo menos 6 caracteres"
        value={form.password}
        onChangeText={change("password")}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
      />
      {register ? (
        <View className="mb-5">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            onPress={() => setTerms((v) => !v)}
            className="flex-row items-center gap-3"
          >
            <Icon name={terms ? "checkbox" : "square-outline"} />
            <Text className="flex-1 text-sm leading-5 text-slate-500">
              Entendo que este é um protótipo e usarei dados fictícios.
            </Text>
          </Pressable>
          {errors.terms && (
            <Text className="mt-2 text-sm text-red-600">{errors.terms}</Text>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Feedback.alert(
              "Recuperação de senha",
              "Neste front não há conta autenticada. Use qualquer senha de 6 caracteres. A recuperação real dependerá do backend.",
            )
          }
          className="mb-5 self-end"
        >
          <Text className="font-semibold text-forest">Esqueci minha senha</Text>
        </Pressable>
      )}
      <Button
        title={register ? "Criar perfil de teste" : "Entrar"}
        onPress={submit}
        icon="arrow-forward"
      />
      <Button
        title={register ? "Já tenho uma conta" : "Criar meu perfil"}
        secondary
        onPress={() => navigation.replace(register ? "Login" : "Register")}
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

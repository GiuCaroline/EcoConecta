import "./global.css";
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppProvider, useApp } from "./src/context/AppContext";
import { Icon } from "./src/components/UI";
import { Welcome, Login, Register } from "./src/screens/Auth";
import { Home, DriverHome, PointHome } from "./src/screens/Home";
import { Points, PointDetail, PointForm } from "./src/screens/Points";
import { Requests, NewRequest, RequestDetail } from "./src/screens/Requests";
import {
  Profile,
  EditProfile,
  Notifications,
  Guide,
  Help,
} from "./src/screens/Profile";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const screenOptions = {
  headerStyle: { backgroundColor: "#f7f8f2" },
  headerTintColor: "#166534",
  headerTitleStyle: { fontWeight: "700" },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: "#f7f8f2" },
};
const tabIcons = {
  Home: "home-outline",
  Points: "location-outline",
  Requests: "cube-outline",
  Profile: "person-outline",
};
function Tabs() {
  const { user } = useApp();
  const home =
    user.role === "driver"
      ? DriverHome
      : user.role === "point"
        ? PointHome
        : Home;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarActiveTintColor: "#166534",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#e2e8f0" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color }) => (
          <Icon name={tabIcons[route.name]} color={color} size={23} />
        ),
      })}
    >
      <Tab.Screen
        name="Home"
        component={home}
        options={{
          title: "EcoConecta",
          tabBarLabel:
            user.role === "driver"
              ? "Minha rota"
              : user.role === "point"
                ? "Meu ponto"
                : "Início",
        }}
      />
      <Tab.Screen
        name="Points"
        component={Points}
        options={{ title: "Pontos de reciclagem", tabBarLabel: "Pontos" }}
      />
      <Tab.Screen
        name="Requests"
        component={Requests}
        options={{ title: "Minhas coletas", tabBarLabel: "Coletas" }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{ title: "Meu perfil", tabBarLabel: "Perfil" }}
      />
    </Tab.Navigator>
  );
}
function Routes() {
  const { user, ready } = useApp();
  if (!ready)
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator size="large" color="#166534" />
        <Text className="mt-4 font-semibold text-forest">
          Preparando um novo ciclo...
        </Text>
      </View>
    );
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {user ? (
          <Stack.Group navigationKey={`app-${user.id}-${user.role}`}>
            <Stack.Screen
              name="Main"
              component={Tabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PointDetail"
              component={PointDetail}
              options={{ title: "Conheça o ponto" }}
            />
            <Stack.Screen
              name="RequestDetail"
              component={RequestDetail}
              options={{ title: "Acompanhar coleta" }}
            />
            {user.role === "resident" && (
              <Stack.Screen
                name="NewRequest"
                component={NewRequest}
                options={{ title: "Agendar coleta" }}
              />
            )}
            {user.role === "point" && (
              <Stack.Screen
                name="PointForm"
                component={PointForm}
                options={{ title: "Dados do ponto" }}
              />
            )}
            <Stack.Screen
              name="EditProfile"
              component={EditProfile}
              options={{ title: "Editar perfil" }}
            />
            <Stack.Screen
              name="Notifications"
              component={Notifications}
              options={{ title: "Notificações" }}
            />
            <Stack.Screen
              name="Guide"
              component={Guide}
              options={{ title: "Guia de reciclagem" }}
            />
            <Stack.Screen
              name="Help"
              component={Help}
              options={{ title: "Ajuda" }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey="auth">
            <Stack.Screen
              name="Welcome"
              component={Welcome}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={Login}
              options={{ title: "Entrar" }}
            />
            <Stack.Screen
              name="Register"
              component={Register}
              options={{ title: "Criar perfil" }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <Routes />
      </AppProvider>
    </SafeAreaProvider>
  );
}

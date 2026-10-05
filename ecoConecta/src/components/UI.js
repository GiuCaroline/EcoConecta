import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import { HeaderHeightContext } from "@react-navigation/elements";
import { useAction } from "../hooks/useAction";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { MATERIALS, STEPS } from "../data/catalog";
import { materialNames } from "../utils/domain";
import { useApp } from "../context/AppContext";
import { cssInterop } from "nativewind";

// SafeAreaView é um componente externo e precisa de interop para className.
cssInterop(SafeAreaView, { className: "style" });

export const Icon = ({ name, size = 22, color = "#166534" }) => (
  <Ionicons name={name} size={size} color={color} />
);
const InputScrollContext = createContext(null);
export function Page({ children, scroll = true }) {
  const { user, refresh, refreshing, syncError } = useApp();
  const headerHeight = useContext(HeaderHeightContext) || 0;
  const scrollRef = useRef(null);
  const focused = useRef(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef(Infinity);
  const keepVisible = useCallback(() => {
    if (Platform.OS === "web" || !focused.current || !scrollRef.current) return;
    const input = focused.current;
    requestAnimationFrame(() => {
      input.measureInWindow?.((x, y, width, height) => {
        scrollRef.current?.measureInWindow((sx, sy, sw, sh) => {
          if (focused.current !== input) return;
          const bottom = Math.min(sy + sh, keyboardTop.current) - 24;
          if (y + height > bottom)
            scrollRef.current?.scrollTo({
              y: Math.max(0, scrollY.current + y + height - bottom),
              animated: true,
            });
        });
      });
    });
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      keepVisible();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = Infinity;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keepVisible]);
  const userId = user?.id;
  useFocusEffect(
    useCallback(() => {
      if (userId) refresh().catch(() => {});
    }, [userId, refresh]),
  );
  const content = (
    <>
      {user && (
        <View className="mb-4">
          {syncError ? (
            <Text
              accessibilityLiveRegion="polite"
              className="mb-2 text-sm text-red-600"
            >
              {syncError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={refreshing}
            onPress={() => refresh().catch(() => {})}
            className="self-end py-2"
          >
            <Text className="text-sm font-semibold text-forest">
              {refreshing ? "Atualizando..." : "Atualizar dados"}
            </Text>
          </Pressable>
        </View>
      )}
      {children}
    </>
  );
  return (
    <SafeAreaView
      className="flex-1 bg-sand"
      edges={["left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={Platform.OS !== "web"}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <InputScrollContext.Provider
          value={{
            focus: (input) => {
              focused.current = input;
              keepVisible();
            },
            blur: (input) => {
              if (focused.current === input) focused.current = null;
            },
          }}
        >
          {scroll ? (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                flexGrow: 1,
                padding: 20,
                paddingBottom: 80,
              }}
              onLayout={keepVisible}
              onScroll={(event) => {
                scrollY.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              refreshControl={
                user ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => refresh().catch(() => {})}
                    tintColor="#166534"
                  />
                ) : undefined
              }
            >
              {content}
            </ScrollView>
          ) : (
            content
          )}
        </InputScrollContext.Provider>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({ eyebrow, title, subtitle }) {
  return (
    <View className="mb-6">
      {eyebrow && (
        <Text className="mb-2 text-xs font-bold uppercase tracking-widest text-forest">
          {eyebrow}
        </Text>
      )}
      <Text className="text-3xl font-bold text-ink">{title}</Text>
      {subtitle && (
        <Text className="mt-2 text-base leading-6 text-slate-500">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
export function Card({ children, className = "" }) {
  return (
    <View
      className={`mb-4 rounded-3xl border border-slate-100 bg-white p-5 ${className}`}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      className={`my-1 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3 ${disabled ? "bg-slate-200" : secondary ? "border border-forest bg-white" : "bg-forest"}`}
    >
      {icon && (
        <Icon
          name={icon}
          color={disabled ? "#94a3b8" : secondary ? "#166534" : "#ffffff"}
          size={20}
        />
      )}
      <Text
        className={`text-center text-base font-bold ${disabled ? "text-slate-500" : secondary ? "text-forest" : "text-white"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, error, multiline, ...props }) {
  const input = useRef(null);
  const scrolling = useContext(InputScrollContext);
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-2xl border bg-white px-4 py-3 text-base text-ink ${error ? "border-red-400" : "border-slate-200"} ${multiline ? "min-h-[100px]" : "min-h-[52px]"}`}
        {...props}
        onFocus={(event) => {
          scrolling?.focus(input.current);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          scrolling?.blur(input.current);
          props.onBlur?.(event);
        }}
      />
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-1 text-sm text-red-600"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
export function Chip({ label, selected, onPress, icon }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      className={`mr-2 mb-2 flex-row items-center gap-2 rounded-2xl border px-4 py-3 ${selected ? "border-forest bg-forest" : "border-slate-200 bg-white"}`}
    >
      {icon && (
        <Icon name={icon} size={18} color={selected ? "white" : "#166534"} />
      )}
      <Text
        className={`text-sm font-semibold ${selected ? "text-white" : "text-slate-600"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function MaterialPicker({ value, onChange }) {
  return (
    <View className="mb-3 flex-row flex-wrap">
      {MATERIALS.map((m) => (
        <Chip
          key={m.id}
          label={m.name}
          icon={m.icon}
          selected={value.includes(m.id)}
          onPress={() =>
            onChange(
              value.includes(m.id)
                ? value.filter((id) => id !== m.id)
                : [...value, m.id],
            )
          }
        />
      ))}
    </View>
  );
}
export function Badge({ text, muted = false }) {
  return (
    <View
      className={`self-start rounded-full px-3 py-1 ${muted ? "bg-slate-100" : "bg-mint"}`}
    >
      <Text
        className={`text-xs font-bold ${muted ? "text-slate-500" : "text-forest"}`}
      >
        {text}
      </Text>
    </View>
  );
}
export function Empty({ title, body, action, onPress }) {
  return (
    <Card>
      <View className="items-center py-6">
        <Icon name="leaf-outline" size={42} />
        <Text className="mt-4 text-center text-lg font-bold text-ink">
          {title}
        </Text>
        <Text className="mb-4 mt-2 text-center leading-6 text-slate-500">
          {body}
        </Text>
        {action && <Button title={action} onPress={onPress} />}
      </View>
    </Card>
  );
}
export function Row({ icon, title, body }) {
  return (
    <View className="mb-4 flex-row gap-3">
      <Icon name={icon} />
      <View className="flex-1">
        <Text className="font-semibold text-ink">{title}</Text>
        <Text className="mt-1 leading-5 text-slate-500">{body}</Text>
      </View>
    </View>
  );
}
export function PointCard({ point, onPress }) {
  const { favorites, favorite } = useApp();
  const { busy, run } = useAction("Favoritos");
  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${point.name}`}
          className="flex-1 flex-row gap-3"
        >
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-mint">
            <Icon name={point.icon} size={28} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">{point.name}</Text>
            <Text className="mt-1 text-xs text-slate-500">{point.hours}</Text>
          </View>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => run(() => favorite(point.id))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            favorites.includes(point.id)
              ? "Remover dos favoritos"
              : "Adicionar aos favoritos"
          }
        >
          <Icon
            name={favorites.includes(point.id) ? "heart" : "heart-outline"}
            color="#166534"
          />
        </Pressable>
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" className="mt-3">
        <Text className="text-sm leading-5 text-slate-500">
          {point.address}
        </Text>
        <Text className="my-3 text-sm font-semibold text-forest">
          {materialNames(point.materials, MATERIALS)}
        </Text>
        <Badge
          text={point.active ? "Recebendo materiais" : "Coletas pausadas"}
          muted={!point.active}
        />
      </Pressable>
    </Card>
  );
}
export function RequestCard({ request, onPress }) {
  const { points } = useApp();
  const point = points.find((p) => p.id === request.pointId);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text className="text-xs font-bold text-slate-500">{request.id}</Text>
          <Badge
            text={request.cancelled ? "Cancelada" : STEPS[request.status]}
            muted={request.cancelled}
          />
        </View>
        <Text className="text-lg font-bold text-ink">
          {materialNames(request.materials, MATERIALS)}
        </Text>
        <Text className="mt-1 text-sm text-slate-500">
          {request.quantity} kg estimados · {request.residentName}
        </Text>
        <Text className="mt-3 text-sm text-slate-500">
          {request.date} · {request.period}
        </Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Icon name="location-outline" size={18} />
          <Text className="flex-1 text-sm font-semibold text-forest">
            {request.pointName || point?.name || "Ponto indisponível"}
          </Text>
          <Icon name="chevron-forward" size={18} />
        </View>
      </Card>
    </Pressable>
  );
}

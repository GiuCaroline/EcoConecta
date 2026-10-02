import { Alert, Platform } from "react-native";

// O Alert nativo não exibe diálogos na versão web.
export const Feedback = {
  alert(title, message, buttons) {
    if (Platform.OS !== "web") return Alert.alert(title, message, buttons);
    const action = buttons?.find((button) => button.style !== "cancel");
    if (action) {
      if (window.confirm(`${title}\n\n${message}`)) action.onPress?.();
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  },
};

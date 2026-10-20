import type { PermissionState } from "@/types/geo";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  title: string;
  description: string;
  state: PermissionState;
  onRequest: () => void;
  onOpenSettings: () => void;
}

export function PermissionPrimer({
  title,
  description,
  state,
  onRequest,
  onOpenSettings,
}: Props) {
  const isBlocked = state === "blocked";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {isBlocked
          ? "Desactivaste este permiso. Puedes habilitarlo desde los Ajustes del sistema."
          : description}
      </Text>
      <Pressable
        onPress={isBlocked ? onOpenSettings : onRequest}
        style={styles.button}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          {isBlocked ? "Abrir Ajustes" : "Permitir acceso"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#d4d4d4",
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 4,
  },
  buttonText: {
    color: "#0a0a0a",
    fontWeight: "bold",
    fontSize: 15,
  },
});

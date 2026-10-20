import { GeoPhotosProvider, useGeoPhotos } from "@/context/GeoPhotosContext";
import { useShake } from "@/hooks/useShake";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabsLayoutContent() {
  const { photos, clearAll } = useGeoPhotos();
  const insets = useSafeAreaInsets();

  // R4: Al agitar el teléfono, un Alert pregunta si se borran todas las fotos
  useShake(() => {
    if (photos.length === 0) return;
    Alert.alert(
      "Borrar fotos",
      `¿Deseas borrar todas las ${photos.length} fotos capturadas?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar todas",
          style: "destructive",
          onPress: () => clearAll(),
        },
      ],
    );
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "#262626",
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#737373",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="geocam"
        options={{
          title: "GeoCam",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <GeoPhotosProvider>
      <TabsLayoutContent />
    </GeoPhotosProvider>
  );
}

import { PermissionPrimer } from "@/components/PermissionPrimer";
import { useGeoPhotos } from "@/context/GeoPhotosContext";
import { useCamera } from "@/hooks/useCamera";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import type { GeoPhoto } from "@/types/geo";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GeoCamScreen() {
  const insets = useSafeAreaInsets();
  const cam = useCamera();
  const geo = useGeoLocation({ watch: true });
  const { photos, addPhoto } = useGeoPhotos();

  // Foto seleccionada para ver en detalle al tocar la miniatura
  const [selectedPhoto, setSelectedPhoto] = useState<GeoPhoto | null>(null);

  // Reto opcional: Nivel con sensor para ayudar a tomar fotos rectas
  const [tilt, setTilt] = useState<number>(0);
  const [isLevel, setIsLevel] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync().then((available) => {
      if (!available || cancelled) return;
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y }) => {
        const angle =
          Math.atan2(x, Math.abs(y) > 0.05 ? y : 0.05) * (180 / Math.PI);
        const clampedAngle = Math.round(angle);
        setTilt(clampedAngle);
        setIsLevel(Math.abs(clampedAngle) <= 3);
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  if (cam.permissionState === "checking") {
    return <View style={styles.container} />;
  }

  if (cam.permissionState !== "granted") {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  // R1: Captura de foto con cámara
  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;

    // Degradación elegante: sin permiso de ubicación, coords queda en null
    const coords =
      geo.permission === "granted"
        ? (geo.coords ?? (await geo.getCurrent()))
        : null;

    const newPhoto: GeoPhoto = {
      id: String(Date.now()),
      uri: photo.uri,
      coords,
      source: "camera",
      createdAt: Date.now(),
    };

    addPhoto(newPhoto);
  };

  // R2 & Reto opcional: Importar desde galería con lectura de EXIF
  const handlePickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    let photoCoords = null;

    if (asset.exif) {
      const exif = asset.exif as Record<string, unknown>;
      const gpsObj = exif["{GPS}"] as Record<string, unknown> | undefined;
      const lat = (
        typeof exif.GPSLatitude === "number"
          ? exif.GPSLatitude
          : gpsObj?.Latitude
      ) as number | undefined;
      const lon = (
        typeof exif.GPSLongitude === "number"
          ? exif.GPSLongitude
          : gpsObj?.Longitude
      ) as number | undefined;
      if (typeof lat === "number" && typeof lon === "number") {
        const latRef = (exif.GPSLatitudeRef ??
          gpsObj?.LatitudeRef ??
          "N") as string;
        const lonRef = (exif.GPSLongitudeRef ??
          gpsObj?.LongitudeRef ??
          "E") as string;
        photoCoords = {
          latitude: latRef === "S" ? -Math.abs(lat) : Math.abs(lat),
          longitude: lonRef === "W" ? -Math.abs(lon) : Math.abs(lon),
          accuracy: null,
          timestamp: Date.now(),
        };
      }
    }

    if (!photoCoords && geo.permission === "granted") {
      photoCoords = geo.coords ?? (await geo.getCurrent());
    }

    const newPhoto: GeoPhoto = {
      id: String(Date.now()),
      uri: asset.uri,
      coords: photoCoords,
      source: "gallery",
      createdAt: Date.now(),
    };

    addPhoto(newPhoto);
  };

  const lastPhoto = photos.length > 0 ? photos[0] : null;

  return (
    <View style={styles.container}>
      {/* Vista de cámara ocupando toda la pantalla */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        onCameraReady={cam.onCameraReady}
      />

      {/* Banner de ubicación contextual debajo del notch / status bar de Android */}
      {geo.permission !== "granted" && geo.permission !== "checking" && (
        <Pressable
          onPress={
            geo.permission === "blocked"
              ? geo.openSettings
              : geo.requestPermission
          }
          style={[styles.locationBanner, { top: insets.top + 10 }]}
        >
          <Ionicons name="location-outline" size={18} color="#1c1917" />
          <Text style={styles.locationBannerText}>
            {geo.permission === "blocked"
              ? "Ubicación desactivada. Toca para abrir Ajustes"
              : "Activa la ubicación para etiquetar tus fotos"}
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo con safe-area */}
      {geo.coords && (
        <View
          style={[
            styles.coordsBadge,
            {
              top:
                insets.top +
                (geo.permission !== "granted" && geo.permission !== "checking"
                  ? 65
                  : 12),
            },
          ]}
        >
          <Text style={styles.coordsTextPrimary}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.coordsTextSecondary}>
            ±{Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
          {geo.coords.accuracy !== null && geo.coords.accuracy > 1000 && (
            <Text style={styles.coordsTextWarning}>
              ⚠️ Ubicación aprox (&gt;1km)
            </Text>
          )}
        </View>
      )}

      {/* Reto opcional: Indicador de nivel para fotos derechas */}
      <View pointerEvents="none" style={styles.levelContainer}>
        <View
          style={[
            styles.levelBadge,
            isLevel ? styles.levelBadgeSuccess : styles.levelBadgeNormal,
            { transform: [{ rotate: `${-tilt}deg` }] },
          ]}
        >
          <View
            style={isLevel ? styles.levelLineSuccess : styles.levelLineNormal}
          />
          <Text style={styles.levelText}>
            {tilt}° {isLevel ? "✓ NIVELADO" : ""}
          </Text>
          <View
            style={isLevel ? styles.levelLineSuccess : styles.levelLineNormal}
          />
        </View>
      </View>

      {/* Controles inferiores posicionados encima de la barra de pestañas y botones de Android */}
      <View style={[styles.bottomControls, { bottom: 20 }]}>
        {/* R1: Miniatura de la última foto tomada o importada */}
        {lastPhoto ? (
          <Pressable
            onPress={() => setSelectedPhoto(lastPhoto)}
            style={styles.thumbnailWrapper}
            accessibilityLabel="Ver última foto"
          >
            <Image
              source={{ uri: lastPhoto.uri }}
              style={styles.thumbnailImage}
            />
            <View
              style={[
                styles.sourceBadge,
                lastPhoto.source === "gallery"
                  ? styles.sourceBadgeGallery
                  : styles.sourceBadgeCamera,
              ]}
            >
              <Ionicons
                name={lastPhoto.source === "gallery" ? "images" : "camera"}
                size={11}
                color="#ffffff"
              />
            </View>
          </Pressable>
        ) : (
          <View style={styles.thumbnailPlaceholder} />
        )}

        {/* Botón de captura principal con guarda isCapturing */}
        <Pressable
          onPress={handleCapture}
          disabled={cam.isCapturing}
          style={styles.shutterOuter}
          accessibilityLabel="Tomar foto"
        >
          {cam.isCapturing ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>

        {/* Botón selector de galería (R2) */}
        <Pressable
          onPress={handlePickFromGallery}
          style={styles.actionButton}
          accessibilityLabel="Importar de galería"
        >
          <Ionicons name="images-outline" size={24} color="#ffffff" />
        </Pressable>

        {/* Botón voltear cámara */}
        <Pressable
          onPress={cam.toggleFacing}
          style={styles.actionButton}
          accessibilityLabel="Cambiar cámara"
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#ffffff" />
        </Pressable>
      </View>

      {/* Modal para ver detalle de la foto seleccionada */}
      {selectedPhoto && (
        <Modal
          visible={!!selectedPhoto}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPhoto(null)}
        >
          <View style={styles.modalOverlay}>
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalles de la foto</Text>
                <View
                  style={[
                    styles.modalBadge,
                    selectedPhoto.source === "gallery"
                      ? styles.sourceBadgeGallery
                      : styles.sourceBadgeCamera,
                  ]}
                >
                  <Text style={styles.modalBadgeText}>
                    {selectedPhoto.source === "gallery" ? "Galería" : "Cámara"}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalText}>
                📅 {new Date(selectedPhoto.createdAt).toLocaleString()}
              </Text>

              <Text style={styles.modalText}>
                📍{" "}
                {selectedPhoto.coords
                  ? `${selectedPhoto.coords.latitude.toFixed(5)}, ${selectedPhoto.coords.longitude.toFixed(5)}`
                  : "Sin ubicación (degradación elegante)"}
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedPhoto(null)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    width: "100%",
    height: "100%",
    position: "relative",
  },
  locationBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.95)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    zIndex: 40,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  locationBannerText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#1c1917",
    textAlign: "center",
  },
  coordsBadge: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 35,
    elevation: 6,
  },
  coordsTextPrimary: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#6ee7b7",
    fontWeight: "bold",
  },
  coordsTextSecondary: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#a3a3a3",
  },
  coordsTextWarning: {
    fontFamily: "monospace",
    fontSize: 10,
    color: "#fcd34d",
    marginTop: 2,
  },
  levelContainer: {
    position: "absolute",
    top: "46%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  levelBadgeNormal: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  levelBadgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.85)",
  },
  levelLineNormal: {
    width: 30,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  levelLineSuccess: {
    width: 30,
    height: 2,
    backgroundColor: "#ffffff",
  },
  levelText: {
    marginHorizontal: 8,
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "monospace",
    color: "#ffffff",
  },
  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    zIndex: 40,
    elevation: 10,
  },
  thumbnailWrapper: {
    position: "relative",
    width: 56,
    height: 56,
  },
  thumbnailImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
  },
  sourceBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  sourceBadgeCamera: {
    backgroundColor: "#059669",
  },
  sourceBadgeGallery: {
    backgroundColor: "#2563eb",
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ffffff",
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: "55%",
    borderRadius: 16,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#171717",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#262626",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalText: {
    fontSize: 13,
    color: "#d4d4d4",
    marginTop: 4,
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: "#262626",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  modalCloseText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
});

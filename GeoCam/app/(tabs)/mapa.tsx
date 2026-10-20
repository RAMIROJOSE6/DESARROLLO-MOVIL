import { useGeoPhotos } from "@/context/GeoPhotosContext";
import { useGeoLocation } from "@/hooks/useGeoLocation";
import type { GeoPhoto } from "@/types/geo";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export default function MapaScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const { photos, removePhoto } = useGeoPhotos();
  const geo = useGeoLocation({ watch: true });

  const [selectedPhoto, setSelectedPhoto] = useState<GeoPhoto | null>(null);
  const [showNoLocationSheet, setShowNoLocationSheet] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Separar fotos con y sin coordenadas
  const photosWithCoords = useMemo(
    () => photos.filter((p) => p.coords !== null),
    [photos],
  );

  const photosWithoutCoords = useMemo(
    () => photos.filter((p) => p.coords === null),
    [photos],
  );

  // Coordenadas objetivo para centrado
  const targetCoords = useMemo(() => {
    if (photosWithCoords.length > 0) {
      return {
        lat: photosWithCoords[0].coords!.latitude,
        lng: photosWithCoords[0].coords!.longitude,
      };
    }
    if (geo.coords) {
      return {
        lat: geo.coords.latitude,
        lng: geo.coords.longitude,
      };
    }
    return {
      lat: 4.60971,
      lng: -74.08175,
    };
  }, [photosWithCoords, geo.coords]);

  // Cuando cambian las fotos o la ubicación, actualizar la vista en Leaflet
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    const dataPayload = {
      type: "UPDATE_DATA",
      center: targetCoords,
      userLocation: geo.coords
        ? { lat: geo.coords.latitude, lng: geo.coords.longitude }
        : null,
      markers: photosWithCoords.map((p) => ({
        id: p.id,
        lat: p.coords!.latitude,
        lng: p.coords!.longitude,
        uri: p.uri,
        source: p.source,
        date: new Date(p.createdAt).toLocaleTimeString(),
      })),
    };

    const js = `window.postMessageFromRN && window.postMessageFromRN(${JSON.stringify(
      dataPayload,
    )}); true;`;
    webViewRef.current.injectJavaScript(js);
  }, [isMapReady, photosWithCoords, geo.coords, targetCoords]);

  // Botón para centrar en foto o usuario
  const handleCenter = () => {
    if (!webViewRef.current) return;
    const js = `if (window.centerMap) { window.centerMap(${targetCoords.lat}, ${targetCoords.lng}); } true;`;
    webViewRef.current.injectJavaScript(js);
  };

  // Recibir mensajes desde Leaflet en el WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "MAP_READY") {
        setIsMapReady(true);
      } else if (data.type === "SELECT_PHOTO") {
        const found = photos.find((p) => p.id === data.photoId);
        if (found) {
          setSelectedPhoto(found);
        }
      }
    } catch {
      // Ignorar mensajes no JSON
    }
  };

  const handleDeletePhoto = (photo: GeoPhoto) => {
    Alert.alert("Eliminar foto", "¿Seguro que deseas eliminar esta foto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          removePhoto(photo.id);
          if (selectedPhoto?.id === photo.id) {
            setSelectedPhoto(null);
          }
        },
      },
    ]);
  };

  // HTML embebido con Leaflet y OpenStreetMap (100% Open Source, sin Google API Key)
  const leafletHtml = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: #0f172a;
          }
          .custom-photo-pin {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .photo-thumb {
            width: 44px;
            height: 44px;
            border-radius: 22px;
            border: 3px solid #10b981;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            background-size: cover;
            background-position: center;
            background-color: #1e293b;
          }
          .pin-arrow {
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 7px solid #10b981;
            margin-top: -1px;
          }
          .user-pulse-dot {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background-color: #3b82f6;
            border: 3px solid #ffffff;
            box-shadow: 0 0 12px #3b82f6;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${targetCoords.lat}, ${targetCoords.lng}], 15);

          // Capa OpenStreetMap 100% libre sin API Key ni marcas de agua
          L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
            maxZoom: 20,
            subdomains: 'abc'
          }).addTo(map);

          var markersLayer = L.layerGroup().addTo(map);
          var userMarker = null;

          function renderMarkers(markers) {
            markersLayer.clearLayers();
            markers.forEach(function(m) {
              var icon = L.divIcon({
                className: '',
                html: '<div class="custom-photo-pin">' +
                        '<div class="photo-thumb" style="background-image: url(\\'' + m.uri + '\\');"></div>' +
                        '<div class="pin-arrow"></div>' +
                      '</div>',
                iconSize: [44, 52],
                iconAnchor: [22, 52]
              });

              var marker = L.marker([m.lat, m.lng], { icon: icon });
              marker.on('click', function() {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SELECT_PHOTO',
                    photoId: m.id
                  }));
                }
              });
              marker.addTo(markersLayer);
            });
          }

          function updateUserLocation(loc) {
            if (!loc) {
              if (userMarker) {
                map.removeLayer(userMarker);
                userMarker = null;
              }
              return;
            }
            var icon = L.divIcon({
              className: '',
              html: '<div class="user-pulse-dot"></div>',
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            });
            if (!userMarker) {
              userMarker = L.marker([loc.lat, loc.lng], { icon: icon }).addTo(map);
            } else {
              userMarker.setLatLng([loc.lat, loc.lng]);
            }
          }

          window.centerMap = function(lat, lng) {
            map.flyTo([lat, lng], 16, { duration: 1.2 });
          };

          window.postMessageFromRN = function(data) {
            if (data.type === 'UPDATE_DATA') {
              renderMarkers(data.markers || []);
              updateUserLocation(data.userLocation);
              if (data.center) {
                map.panTo([data.center.lat, data.center.lng]);
              }
            }
          };

          // Notificar a React Native que Leaflet cargó
          setTimeout(function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
            }
          }, 300);
        </script>
      </body>
      </html>
    `;
  }, [targetCoords.lat, targetCoords.lng]);

  return (
    <View style={styles.container}>
      {/* Encabezado superior con insets para el notch / status bar */}
      <View style={[styles.topHeader, { top: insets.top + 10 }]}>
        <View style={styles.counterBadge}>
          <Text style={styles.counterText}>
            🗺️ OpenStreetMap: {photosWithCoords.length} en mapa
          </Text>
        </View>

        {photosWithoutCoords.length > 0 && (
          <Pressable
            onPress={() => setShowNoLocationSheet(true)}
            style={styles.noLocationButton}
          >
            <Ionicons name="location-outline" size={16} color="#000000" />
            <Text style={styles.noLocationText}>
              {photosWithoutCoords.length} Sin ubicación
            </Text>
          </Pressable>
        )}
      </View>

      {/* Botón flotante para centrar mapa en la foto / GPS */}
      <View style={[styles.floatingControls, { bottom: 24 }]}>
        <Pressable
          onPress={handleCenter}
          style={styles.centerButton}
          accessibilityLabel="Centrar mapa"
        >
          <Ionicons name="locate" size={24} color="#10b981" />
        </Pressable>
      </View>

      {/* Mapa interactivo Open Source (Leaflet + OpenStreetMap) */}
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: leafletHtml }}
        style={StyleSheet.absoluteFill}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        scrollEnabled={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>
              Cargando mapa OpenStreetMap...
            </Text>
          </View>
        )}
        startInLoadingState
      />

      {/* Modal/Sheet para fotos Sin Ubicación */}
      <Modal
        visible={showNoLocationSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoLocationSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <View
            style={[styles.sheetContent, { paddingBottom: insets.bottom + 20 }]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitle}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color="#f59e0b"
                />
                <Text style={styles.sheetHeaderText}>
                  Fotos sin ubicación ({photosWithoutCoords.length})
                </Text>
              </View>
              <Pressable
                onPress={() => setShowNoLocationSheet(false)}
                style={styles.sheetCloseButton}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetList}>
              {photosWithoutCoords.map((photo) => (
                <Pressable
                  key={photo.id}
                  onPress={() => {
                    setShowNoLocationSheet(false);
                    setSelectedPhoto(photo);
                  }}
                  style={styles.sheetItem}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.sheetItemImage}
                  />
                  <View style={styles.sheetItemInfo}>
                    <Text style={styles.sheetItemTitle}>
                      {photo.source === "camera" ? "📷 Cámara" : "🖼️ Galería"}
                    </Text>
                    <Text style={styles.sheetItemTime}>
                      {new Date(photo.createdAt).toLocaleString()}
                    </Text>
                    <Text style={styles.sheetItemWarning}>
                      Sin coordenadas GPS
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para ver foto completa */}
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
              <View style={styles.modalCardHeader}>
                <Text style={styles.modalTitle}>Detalles de la foto</Text>
                <View
                  style={[
                    styles.modalBadge,
                    selectedPhoto.source === "gallery"
                      ? styles.badgeGallery
                      : styles.badgeCamera,
                  ]}
                >
                  <Text style={styles.badgeText}>
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
                  : "Sin ubicación registrada"}
              </Text>
              {selectedPhoto.coords?.accuracy && (
                <Text style={styles.modalAccuracy}>
                  Precisión: ±{Math.round(selectedPhoto.coords.accuracy)} m
                </Text>
              )}

              <View style={styles.modalButtonsRow}>
                <Pressable
                  onPress={() => handleDeletePhoto(selectedPhoto)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedPhoto(null)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    position: "relative",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  loadingText: {
    color: "#34d399",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "bold",
  },
  topHeader: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  counterText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  noLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
  },
  noLocationText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#1c1917",
  },
  floatingControls: {
    position: "absolute",
    right: 16,
    zIndex: 25,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#10b981",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    maxHeight: "70%",
    backgroundColor: "#171717",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
    marginBottom: 12,
  },
  sheetHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  sheetHeaderText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  sheetCloseButton: {
    backgroundColor: "#262626",
    borderRadius: 16,
    padding: 6,
  },
  sheetList: {
    maxHeight: 350,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#262626",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  sheetItemImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  sheetItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sheetItemTitle: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  sheetItemTime: {
    color: "#a3a3a3",
    fontSize: 11,
    marginTop: 2,
  },
  sheetItemWarning: {
    color: "#f59e0b",
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
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
  modalCardHeader: {
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
    borderRadius: 10,
  },
  badgeCamera: {
    backgroundColor: "#059669",
  },
  badgeGallery: {
    backgroundColor: "#2563eb",
  },
  badgeText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 13,
    color: "#d4d4d4",
    marginTop: 4,
  },
  modalAccuracy: {
    fontSize: 11,
    color: "#a3a3a3",
    marginTop: 2,
  },
  modalButtonsRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#f87171",
    fontWeight: "bold",
    fontSize: 14,
  },
  closeButton: {
    flex: 1,
    backgroundColor: "#262626",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
});

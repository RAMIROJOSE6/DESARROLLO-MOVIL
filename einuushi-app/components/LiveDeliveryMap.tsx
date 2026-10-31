import React from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface LiveDeliveryMapProps {
  orderId?: string;
  statusCode?: string; // 'PENDING' | 'DISPATCHED' | 'ARRIVED' | 'DELIVERED'
  driverName?: string;
  vehicleType?: string;
  plateOrNit?: string;
  deliveryAddress?: string;
  city?: string;
  driverLat?: number;
  driverLng?: number;
  height?: number | string;
}

// Coordenadas base de referencia para Riohacha, La Guajira
const DEFAULT_STORE_LAT = 11.5444; // Tienda Einuushi Centro / Calancala
const DEFAULT_STORE_LNG = -72.9072;
const DEFAULT_CLIENT_LAT = 11.5360; // Destino de entrega cliente
const DEFAULT_CLIENT_LNG = -72.9150;

export const LiveDeliveryMap: React.FC<LiveDeliveryMapProps> = ({
  orderId = '',
  statusCode = 'PENDING',
  driverName = 'Repartidor Einuushi',
  vehicleType = 'Motocicleta',
  plateOrNit = '',
  deliveryAddress = 'Riohacha, La Guajira',
  city = 'Riohacha',
  driverLat,
  driverLng,
  height = '100%',
}) => {
  const isPending = statusCode === 'PENDING';
  const isEnRuta = statusCode === 'DISPATCHED';
  const isArrived = statusCode === 'ARRIVED';
  const isDelivered = statusCode === 'DELIVERED';

  const storeLat = DEFAULT_STORE_LAT;
  const storeLng = DEFAULT_STORE_LNG;
  const clientLat = DEFAULT_CLIENT_LAT;
  const clientLng = DEFAULT_CLIENT_LNG;

  // Si está en ruta o esperando llegada, se ubica la moto
  let currentDriverLat = driverLat ?? (isPending ? storeLat : (isArrived ? clientLat : 11.5402));
  let currentDriverLng = driverLng ?? (isPending ? storeLng : (isArrived ? clientLng : -72.9110));

  const escapedAddress = (deliveryAddress || 'Riohacha, La Guajira').replace(/'/g, "\\'");
  const escapedDriver = (driverName || 'Repartidor').replace(/'/g, "\\'");
  const escapedVehicle = `${vehicleType || 'Moto'} ${plateOrNit ? `(${plateOrNit})` : ''}`.replace(/'/g, "\\'");

  const statusTitle = isDelivered
    ? '✅ ¡Pedido Entregado con Éxito!'
    : (isArrived
      ? '🛵 ¡Repartidor en la Puerta!'
      : (isEnRuta
        ? '🛵 Repartidor en Camino'
        : '🏪 Pedido en Tienda Einuushi'));

  const statusSub = isDelivered
    ? 'Entrega finalizada en tu dirección • ¡Gracias por tu compra!'
    : (isArrived
      ? `${escapedDriver} está esperando en tu dirección`
      : (isEnRuta
        ? `${escapedDriver} • ${escapedVehicle}`
        : `${escapedAddress}`));

  const statusBadge = isDelivered
    ? '🎉 Entregado'
    : (isArrived
      ? '📍 En Puerta'
      : (isEnRuta
        ? '⚡ En Vivo'
        : '📦 Preparando'));

  const leafletHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Seguimiento de Entrega Einuushi</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #F1F5F9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .custom-badge {
      background: ${isDelivered ? '#166534' : '#1E2B58'};
      color: #FFFFFF;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1.5px solid ${isDelivered ? '#86EFAC' : '#C5A880'};
      white-space: nowrap;
    }
    .marker-icon-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 36px;
      height: 36px;
      border-radius: 18px;
      background: #FFFFFF;
      border: 3px solid #1E2B58;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      font-size: 18px;
    }
    .driver-marker {
      border-color: #D97706;
      background: #FEF3C7;
      animation: pulse 1.8s infinite;
    }
    .client-marker {
      border-color: #10B981;
      background: #ECFDF5;
    }
    .delivered-marker {
      border-color: #166534;
      background: #DCFCE7;
      animation: pulseGreen 2s infinite;
    }
    .store-marker {
      border-color: #1E2B58;
      background: #EEF2FF;
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7); }
      70% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(217, 119, 6, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
    }
    @keyframes pulseGreen {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 101, 52, 0.7); }
      70% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(22, 101, 52, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 101, 52, 0); }
    }
    .leaflet-popup-content-wrapper {
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .status-panel {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 1000;
      background: ${isDelivered ? 'rgba(20, 83, 45, 0.95)' : 'rgba(30, 43, 88, 0.94)'};
      color: #FFFFFF;
      padding: 8px 12px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      border: 1px solid ${isDelivered ? '#86EFAC' : '#C5A880'};
    }
    .status-title {
      font-size: 12px;
      font-weight: bold;
    }
    .status-sub {
      font-size: 10px;
      color: #CBD5E1;
    }
  </style>
</head>
<body>
  <div class="status-panel">
    <div>
      <div class="status-title">${statusTitle}</div>
      <div class="status-sub">${statusSub}</div>
    </div>
    <div class="custom-badge">${statusBadge}</div>
  </div>

  <div id="map"></div>

  <script>
    try {
      const isDelivered = ${isDelivered};
      const isEnRuta = ${isEnRuta};
      const isArrived = ${isArrived};
      const isPending = ${isPending};

      const storeCoords = [${storeLat}, ${storeLng}];
      const clientCoords = [${clientLat}, ${clientLng}];
      const driverCoords = [${currentDriverLat}, ${currentDriverLng}];

      const initialCenter = isDelivered ? clientCoords : driverCoords;

      const map = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView(initialCenter, 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Icono Tienda
      const storeIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-icon-wrapper store-marker">🏪</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });

      // Icono Cliente Destino (Normal)
      const clientIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-icon-wrapper client-marker">📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });

      // Icono Entrega Exitosa (Cuando ya fue entregado)
      const deliveredIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-icon-wrapper delivered-marker">✅</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });

      // Icono Repartidor (Solo mientras el pedido esté pendiente de entrega)
      const driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-icon-wrapper driver-marker">🛵</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -19]
      });

      // Marcador Tienda
      L.marker(storeCoords, { icon: storeIcon })
        .addTo(map)
        .bindPopup('<b>Tienda Einuushi</b><br>Punto de despacho central (Riohacha)');

      if (isDelivered) {
        // SI YA FUE ENTREGADO: No se muestra la ubicación privada del repartidor.
        // Se muestra únicamente el punto de destino con la confirmación de Pedido Entregado.
        L.marker(clientCoords, { icon: deliveredIcon })
          .addTo(map)
          .bindPopup('<b>¡Pedido Entregado con Éxito! ✅</b><br>${escapedAddress}<br><i>Entregado por: ${escapedDriver}</i>')
          .openPopup();

        // Línea de ruta completada
        L.polyline([storeCoords, clientCoords], {
          color: '#166534',
          weight: 4,
          opacity: 0.8
        }).addTo(map);

        const bounds = L.latLngBounds([storeCoords, clientCoords]);
        map.fitBounds(bounds, { padding: [50, 50] });

      } else {
        // SI AÚN NO HA SIDO ENTREGADO (En ruta o en puerta):
        // El cliente está a la espera y SÍ ve al repartidor en camino.
        L.marker(clientCoords, { icon: clientIcon })
          .addTo(map)
          .bindPopup('<b>Destino de Entrega</b><br>${escapedAddress}')
          .openPopup();

        const driverPopupText = isArrived
          ? '<b>${escapedDriver}</b><br>${escapedVehicle}<br><b style="color:#B45309;">📍 ¡Esperando en tu puerta!</b>'
          : (isEnRuta
            ? '<b>${escapedDriver}</b><br>${escapedVehicle}<br><b style="color:#1E2B58;">🛵 En camino a tu dirección</b>'
            : '<b>${escapedDriver}</b><br>${escapedVehicle}<br><i>En preparación en tienda</i>');

        L.marker(driverCoords, { icon: driverIcon })
          .addTo(map)
          .bindPopup(driverPopupText);

        const routePoints = [storeCoords, driverCoords, clientCoords];
        L.polyline(routePoints, {
          color: '#1E2B58',
          weight: 4,
          opacity: 0.75,
          dashArray: '6, 8'
        }).addTo(map);

        const bounds = L.latLngBounds([storeCoords, clientCoords, driverCoords]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }

    } catch (e) {
      console.error('Error renderizando mapa Leaflet:', e);
    }
  </script>
</body>
</html>`;

  return (
    <View style={[styles.container, { height }]}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={leafletHtml}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 14 }}
          title={`Mapa Seguimiento Pedido ${orderId}`}
        />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webView}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1E2B58" />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

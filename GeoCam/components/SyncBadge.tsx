// components/SyncBadge.tsx
// Indicador del estado de sincronización (T6) y Pantalla/Detalle de Estado (C4).
// Al tocarlo muestra fotos pendientes, fecha de última sincro, resultado, último error y botón para sincronizar.
import type { ComponentProps } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/hooks/useSync';

export function SyncBadge() {
  const sync = useSync();

  let icon: ComponentProps<typeof Ionicons>['name'] = 'cloud-done-outline';
  let color = '#10b981';
  let label = 'Al día';

  if (!sync.isOnline) {
    icon = 'cloud-offline-outline';
    color = '#fbbf24';
    label = sync.pendingCount > 0 ? `Sin conexión · ${sync.pendingCount} pendientes` : 'Sin conexión';
  } else if (sync.isSyncing) {
    icon = 'sync-outline';
    color = '#38bdf8';
    label = 'Sincronizando…';
  } else if (sync.error) {
    icon = 'alert-circle-outline';
    color = '#f87171';
    label = 'Error al sincronizar';
  } else if (sync.pendingCount > 0) {
    icon = 'cloud-upload-outline';
    color = '#fbbf24';
    label = `${sync.pendingCount} pendientes`;
  }

  // C4: Pantalla/Detalle de estado de sincronización
  const showStatusDialog = () => {
    const lastSyncTime = sync.lastResult?.finishedAt
      ? new Date(sync.lastResult.finishedAt).toLocaleString('es-CO')
      : 'Aún no sincronizado';
    const resultText = sync.lastResult
      ? `• Subidas: ${sync.lastResult.pushed}\n• Bajadas: ${sync.lastResult.pulled}`
      : '• Ningún ciclo completado aún';
    const errorText = sync.error
      ? `\n\nÚltimo error: ${sync.error.message}`
      : '';

    Alert.alert(
      'Estado de Sincronización (Offline-First)',
      `Conexión: ${sync.isOnline ? '🟢 En línea' : '🟠 Sin conexión'}\n` +
      `Fotos pendientes por subir: ${sync.pendingCount}\n` +
      `Última sincronización: ${lastSyncTime}\n\n` +
      `Resultado del último ciclo:\n${resultText}${errorText}`,
      [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Sincronizar ahora',
          onPress: () => sync.syncNow(),
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={showStatusDialog}
      className="flex-row items-center gap-1.5 self-start rounded-full bg-neutral-900/90 px-3 py-1.5"
      accessibilityRole="button"
      accessibilityLabel={`Estado de sincronización: ${label}`}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color }} className="text-xs font-medium">
        {label}
      </Text>
    </Pressable>
  );
}

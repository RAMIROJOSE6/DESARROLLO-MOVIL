import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0B132B' },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarStyle: {
          backgroundColor: '#0B132B',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bahías',
          headerTitle: 'Control de Bahías y Ocupación',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="grid-outline" size={size} color={color ?? '#38BDF8'} />
          ),
        }}
      />
      <Tabs.Screen
        name="nuevo-ingreso"
        options={{
          title: 'Entrada',
          headerTitle: 'Recepción e Ingreso Vehicular',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="log-in-outline" size={size} color={color ?? '#38BDF8'} />
          ),
        }}
      />
      <Tabs.Screen
        name="auditoria"
        options={{
          title: 'Salida',
          headerTitle: 'Inspección y Entrega Vehicular',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="log-out-outline" size={size} color={color ?? '#38BDF8'} />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          headerTitle: 'Historial y Actas de Servicio',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="receipt-outline" size={size} color={color ?? '#38BDF8'} />
          ),
        }}
      />
    </Tabs>
  );
}

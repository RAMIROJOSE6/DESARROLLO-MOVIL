import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0', borderBottomWidth: 1 },
        headerTintColor: '#0F172A',
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 5,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bahías',
          headerTitle: 'Control de Bahías y Ocupación',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="grid-outline" size={size} color={color ?? '#2563EB'} />
          ),
        }}
      />
      <Tabs.Screen
        name="nuevo-ingreso"
        options={{
          title: 'Entrada',
          headerTitle: 'Recepción e Ingreso Vehicular',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="log-in-outline" size={size} color={color ?? '#2563EB'} />
          ),
        }}
      />
      <Tabs.Screen
        name="auditoria"
        options={{
          title: 'Salida',
          headerTitle: 'Inspección y Entrega Vehicular',
          tabBarIcon: ({ color, size }: any) => (
            <Ionicons name="log-out-outline" size={size} color={color ?? '#2563EB'} />
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

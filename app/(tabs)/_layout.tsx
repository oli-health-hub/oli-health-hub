import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/designSystem';
import { useSupabaseInit } from '../../src/hooks/useSupabaseInit';

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused }: { name: IoniconName; focused: boolean }) {
  return <Ionicons name={name} size={24} color={focused ? colors.oliGreen : colors.oliLightGray} />;
}

export default function TabLayout() {
  useSupabaseInit();
  const insets = useSafeAreaInsets();

  const bottomPad = Platform.OS === 'ios' ? 24 : insets.bottom + 6;
  const barHeight = Platform.OS === 'ios' ? 82 : 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.oliGreen,
        tabBarInactiveTintColor: colors.oliLightGray,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '500', marginBottom: Platform.OS === 'ios' ? 0 : 2 },
        tabBarIconStyle:  { marginTop: 2 },
        tabBarItemStyle:  { paddingHorizontal: 0 },
        tabBarStyle: {
          backgroundColor:  colors.white,
          borderTopColor:   colors.border,
          height:           barHeight,
          paddingBottom:    bottomPad,
          paddingTop:       4,
        },
        headerStyle:      { backgroundColor: colors.white },
        headerTintColor:  colors.oliDarkGray,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:        'Início',
          headerShown:  false,
          tabBarIcon:   ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title:       'Salas',
          headerShown: false,
          tabBarIcon:  ({ focused }) => <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pacientes"
        options={{
          title:      'Pacientes',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="comunidade"
        options={{
          title:       'Comunidade',
          headerShown: false,
          tabBarIcon:  ({ focused }) => <TabIcon name={focused ? 'earth' : 'earth-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ecossistema"
        options={{
          title:      'Ecossistema',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'leaf' : 'leaf-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title:      'Financeiro',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

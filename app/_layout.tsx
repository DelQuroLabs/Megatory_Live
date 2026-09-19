import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabDock } from '../components/TabDock';
import { KioskGate } from '../components/KioskGate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <KioskGate>
        <Tabs
          tabBar={(props) => <TabDock {...(props as any)} />}
          screenOptions={{
            headerStyle: { backgroundColor: 'rgba(255,255,255,0.92)' },
            headerTintColor: '#15284C',
            headerTitleStyle: { fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
            headerShadowVisible: false,
            tabBarHideOnKeyboard: true,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Stock',
              headerTitle: 'Megatory Live',
            }}
          />
          <Tabs.Screen
            name="scan"
            options={{
              title: 'Scan',
              headerTitle: 'Scan Bottle',
            }}
          />
          <Tabs.Screen
            name="add"
            options={{
              title: 'Add',
              headerTitle: 'Add Item',
            }}
          />
          <Tabs.Screen
            name="import-export"
            options={{
              title: 'Files',
              headerTitle: 'Files & Export',
            }}
          />
          <Tabs.Screen name="_sitemap" options={{ href: null }} />
          <Tabs.Screen name="+not-found" options={{ href: null }} />
        </Tabs>
      </KioskGate>
    </SafeAreaProvider>
  );
}

import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: 'rgba(255,255,255,0.92)' },
          headerTintColor: '#15284C',
          headerTitleStyle: { fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
          headerShadowVisible: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderTopWidth: 0,
            borderRadius: 28,
            height: 72,
            paddingBottom: 8,
            paddingTop: 8,
            shadowColor: '#15284C',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 20,
            borderWidth: 1,
            borderColor: '#dce8f0',
          },
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#5b7a9a',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
          tabBarItemStyle: { borderRadius: 20, marginHorizontal: 4, paddingVertical: 4 },
          tabBarActiveBackgroundColor: '#15284C',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Stock',
            tabBarLabel: 'Stock',
            headerTitle: 'Megatory Live',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 12, padding: 2 }}>
                <Text style={{ color: focused ? 'white' : color, fontSize: 20 }}>📋</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarLabel: 'Scan',
            headerTitle: 'Scan Bottle',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 12, padding: 2 }}>
                <Text style={{ color: focused ? 'white' : color, fontSize: 20 }}>📷</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: 'Add',
            tabBarLabel: 'Add',
            headerTitle: 'Add Item',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 12, padding: 2 }}>
                <Text style={{ color: focused ? 'white' : color, fontSize: 20 }}>＋</Text>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="import-export"
          options={{
            title: 'Files',
            tabBarLabel: 'Files',
            headerTitle: 'Files & Export',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ backgroundColor: focused ? 'rgba(255,255,255,0.15)' : 'transparent', borderRadius: 12, padding: 2 }}>
                <Text style={{ color: focused ? 'white' : color, fontSize: 20 }}>📁</Text>
              </View>
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

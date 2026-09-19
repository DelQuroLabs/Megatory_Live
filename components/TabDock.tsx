import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DockRoute = {
  key: string;
  name: string;
  params?: object;
};

type DockProps = {
  state: { index: number; routes: DockRoute[] };
  descriptors: Record<string, { options: { href?: null | string; title?: string; tabBarLabel?: string } }>;
  navigation: {
    emit: (e: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const ICONS: Record<string, string> = {
  index: '📋',
  scan: '📷',
  add: '＋',
  'import-export': '📁',
};

const LABELS: Record<string, string> = {
  index: 'Stock',
  scan: 'Scan',
  add: 'Add',
  'import-export': 'Files',
};

/**
 * Phone-sized pill dock.
 *
 * Expo Router's default tab bar stretches edge-to-edge on web and also
 * surfaces extra routes (_sitemap, +not-found) as mystery tabs. This dock
 * only shows the four real rooms, centered, max 440px — like four big
 * fridge magnets, not a long melted candy bar.
 */
export function TabDock(props: any) {
  const { state, descriptors, navigation } = props as DockProps;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dockWidth = Math.min(440, Math.max(280, width - 32));

  const visible = state.routes.filter((route: DockRoute) => {
    const href = descriptors[route.key]?.options?.href;
    if (href === null) return false;
    return Boolean(LABELS[route.name]);
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={[styles.dock, { width: dockWidth }]}>
        {visible.map(route => {
          const index = state.routes.findIndex(r => r.key === route.key);
          const focused = state.index === index;
          const label = LABELS[route.name] || route.name;
          const icon = ICONS[route.name] || '•';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${label} tab${focused ? ' (selected)' : ''}`}
              style={[styles.tab, focused && styles.tabActive]}
            >
              <Text style={[styles.icon, focused && styles.iconActive]}>{icon}</Text>
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#dce8f0',
    padding: 6,
    height: 68,
    overflow: 'hidden',
    shadowColor: '#15284C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 16,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabActive: {
    backgroundColor: '#15284C',
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
    color: '#5b7a9a',
  },
  iconActive: {
    color: '#ffffff',
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#5b7a9a',
    fontFamily: Platform.OS === 'web' ? 'Nunito, system-ui, sans-serif' : undefined,
  },
  labelActive: {
    color: '#ffffff',
  },
});

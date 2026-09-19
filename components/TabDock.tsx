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

const LABELS: Record<string, string> = {
  index: 'Stock',
  scan: 'Scan',
  add: 'Add',
  'import-export': 'Files',
};

/**
 * Phone-sized dock — four rooms, no emoji, no mystery sitemap tabs.
 * Navy like the kiosk clock; selected tab is cyan so it reads as one switch,
 * not four different sticker icons.
 */
export function TabDock(props: any) {
  const { state, descriptors, navigation } = props as DockProps;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dockWidth = Math.min(420, Math.max(300, width - 24));

  const visible = state.routes.filter((route: DockRoute) => {
    const href = descriptors[route.key]?.options?.href;
    if (href === null) return false;
    return Boolean(LABELS[route.name]);
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={[styles.dock, { width: dockWidth }]} accessibilityRole="tablist">
        {visible.map(route => {
          const index = state.routes.findIndex(r => r.key === route.key);
          const focused = state.index === index;
          const label = LABELS[route.name] || route.name;

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
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${label} tab${focused ? ' (selected)' : ''}`}
              style={[styles.tab, focused && styles.tabActive]}
            >
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
    pointerEvents: 'box-none',
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: '#15284C',
    borderRadius: 22,
    padding: 4,
    minHeight: 56,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  tabActive: {
    backgroundColor: '#00BBDD',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#CDE8F0',
    fontFamily: Platform.OS === 'web' ? 'Nunito, system-ui, sans-serif' : undefined,
  },
  labelActive: {
    color: '#15284C',
  },
});

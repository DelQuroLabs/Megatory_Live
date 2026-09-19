import React from 'react';
import { Platform, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { PAIRDROP_URL } from '../lib/share/pairdrop';

export function PairDropLink() {
  if (Platform.OS === 'web') {
    return React.createElement(
      'a',
      {
        href: PAIRDROP_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': 'Open pairdrop.net in a new window',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1E4A7A',
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
          borderRadius: 16,
          textDecoration: 'none',
          marginBottom: 10,
        },
      },
      React.createElement(
        'span',
        { style: { color: 'white', fontWeight: 800, fontSize: 14 } },
        'Open pairdrop.net ↗',
      ),
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel="Open pairdrop.net in a new window"
      style={styles.btn}
      onPress={() => Linking.openURL(PAIRDROP_URL)}
    >
      <Text style={styles.btnText}>Open pairdrop.net</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: '#1E4A7A', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { color: 'white', fontWeight: '800', fontSize: 14 },
});

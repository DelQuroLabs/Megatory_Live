import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CANONICAL_APP_URL } from '../lib/share/appUrl';
import { APP_QR_SRC } from '../lib/share/qr';

export function ShareQr() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(CANONICAL_APP_URL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <View style={styles.card} accessibilityLabel={`QR code to open Megatory Live at ${CANONICAL_APP_URL}`}>
      <Text style={styles.title}>📲 Open on another phone</Text>
      <Text style={styles.desc}>
        Point any phone camera at this square — like a door sticker. It opens the live app. Each phone keeps its own notebook. They do not share counts until you export Excel on one and import it on another.
      </Text>
      <View style={styles.qrWrap}>
        {Platform.OS === 'web'
          ? React.createElement('img', {
              src: APP_QR_SRC,
              width: 200,
              height: 200,
              alt: `QR code for ${CANONICAL_APP_URL}`,
              style: { width: 200, height: 200 },
            })
          : <Text style={styles.url}>{CANONICAL_APP_URL}</Text>}
      </View>
      <Text style={styles.url} selectable>{CANONICAL_APP_URL}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Copy app link"
        style={styles.btn}
        onPress={copy}
      >
        <Text style={styles.btnText}>{copied ? 'Copied' : 'Copy link'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#CDE8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#15284C', marginBottom: 4, letterSpacing: -0.3, alignSelf: 'stretch' },
  desc: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 14, lineHeight: 18, alignSelf: 'stretch' },
  qrWrap: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE8F0',
    marginBottom: 12,
  },
  url: { fontSize: 12, fontWeight: '700', color: '#15284C', marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: '#15284C', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, alignSelf: 'stretch', alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 14 },
});

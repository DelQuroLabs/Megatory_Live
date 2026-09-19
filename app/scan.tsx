import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { InventoryItem, findItemByBarcode } from '../lib/domain/inventory';
import { loadInventory, saveInventory, loadMeta } from '../lib/storage/inventoryStorage';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [typed, setTyped] = useState('');
  const [lastData, setLastData] = useState('');
  const [lookedUp, setLookedUp] = useState(false);
  const [match, setMatch] = useState<InventoryItem | null>(null);
  const [flash, setFlash] = useState('');
  const router = useRouter();

  useEffect(() => {
    requestPermission();
    // Ask once on open. If the person says no, the type-in box below still works.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookup = async (data: string) => {
    const code = String(data || '').trim();
    if (!code) return;
    setScanned(true);
    setLastData(code);
    setTyped(code);
    const inventory = await loadInventory();
    const existing = findItemByBarcode(inventory, code) || null;
    setMatch(existing);
    setLookedUp(true);
    setFlash('');
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanned) return;
    if (!result?.data) return;
    lookup(result.data);
  };

  const resetScan = () => {
    setScanned(false);
    setLookedUp(false);
    setMatch(null);
    setFlash('');
  };

  const addOne = async (item: InventoryItem) => {
    const inventory = await loadInventory();
    const meta = await loadMeta();
    const next = inventory.map(i =>
      i.id === item.id
        ? {
            ...i,
            quantityOnHand: (i.quantityOnHand || 0) + 1,
            lastCountedAt: new Date().toISOString(),
            countedBy: i.countedBy || meta.deviceName || 'Phone',
          }
        : i,
    );
    await saveInventory(next);
    const updated = next.find(i => i.id === item.id) || item;
    setMatch(updated);
    setFlash(`Added 1 — now ${updated.quantityOnHand} ${updated.unit}`);
  };

  const cameraOn = Boolean(permission?.granted);

  return (
    <View style={styles.container}>
      {cameraOn ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcode}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <View style={styles.scanPill}><Text style={styles.scanText}>Align barcode within frame 🎯</Text></View>
            {lastData ? <View style={styles.lastPill}><Text style={styles.lastText}>Last: {lastData}</Text></View> : null}
          </View>
        </CameraView>
      ) : (
        <View style={styles.noCam}>
          <View style={styles.emptyBlob}><Text style={{ fontSize: 36 }}>⌨️</Text></View>
          <Text style={styles.title}>Type the bottle number</Text>
          <Text style={styles.sub}>
            Camera is off on this phone (or the browser said no). You can still type the barcode / manufacturer number — same as writing it on a clipboard.
          </Text>
          {permission && !permission.granted ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Grant camera permission" style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.btnText}>Try Camera</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.bottom}>
        <Text style={styles.typeLabel}>Or type the barcode</Text>
        <View style={styles.typeRow}>
          <TextInput
            style={styles.typeInput}
            value={typed}
            onChangeText={setTyped}
            placeholder="Manufacturer number / barcode"
            placeholderTextColor="#94a3b8"
            accessibilityLabel="Type barcode or manufacturer number"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => lookup(typed)}
          />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Look up typed barcode" style={styles.lookupBtn} onPress={() => lookup(typed)}>
            <Text style={styles.btnText}>Look up</Text>
          </TouchableOpacity>
        </View>

        {lookedUp ? (
          <View style={styles.resultCard} accessibilityLiveRegion="polite">
            {match ? (
              <>
                <Text style={styles.resultKicker}>On this phone</Text>
                <Text style={styles.resultTitle}>{match.drugName || 'Unnamed drug'}</Text>
                <Text style={styles.resultMeta}>{match.barcode} · now {match.quantityOnHand} {match.unit}</Text>
                {flash ? <Text style={styles.flash}>{flash}</Text> : null}
                <View style={styles.resultActions}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add one ${match.drugName || 'item'}`} style={styles.resultBtn} onPress={() => addOne(match)}>
                    <Text style={styles.btnText}>+1 now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add a typed quantity"
                    style={[styles.resultBtn, styles.btnSecondary]}
                    onPress={() => router.replace({ pathname: '/add', params: { id: match.id, mode: 'addQty', barcode: lastData } })}
                  >
                    <Text style={[styles.btnText, { color: '#15284C' }]}>Add qty</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${match.drugName || 'item'}`}
                    style={[styles.resultBtn, styles.btnSecondary]}
                    onPress={() => router.replace({ pathname: '/add', params: { id: match.id } })}
                  >
                    <Text style={[styles.btnText, { color: '#15284C' }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.resultKicker}>Not in this phone's list</Text>
                <Text style={styles.resultTitle}>{lastData}</Text>
                <Text style={styles.resultMeta}>Create it, or scan again. Dashes and extra zeros are ignored when matching.</Text>
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Create new item from this barcode"
                    style={styles.resultBtn}
                    onPress={() => router.replace({ pathname: '/add', params: { barcode: lastData } })}
                  >
                    <Text style={styles.btnText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Vet Med Tips 💡</Text>
            <Text style={styles.tip}>• Camera or type-in — both look up the same list</Text>
            <Text style={styles.tip}>• Extra zeros and dashes on the bottle still match the sheet</Text>
            <Text style={styles.tip}>• +1 now adds one on this phone only</Text>
          </View>
        )}

        <View style={styles.navRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={scanned ? 'Scan another barcode' : 'Ready to scan barcode'} style={styles.btn} onPress={resetScan}>
            <Text style={styles.btnText}>{scanned ? 'Scan Again' : 'Ready to Scan'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel scan" style={[styles.btn, styles.btnSecondary]} onPress={() => router.back()}>
            <Text style={[styles.btnText, { color: '#15284C' }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enter medication manually" style={[styles.btn, styles.btnTertiary]} onPress={() => router.replace({ pathname: '/add', params: { barcode: lastData || typed || '' } })}>
            <Text style={styles.btnText}>＋ Manual</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FB' },
  camera: { flex: 1, minHeight: 220 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20 },
  scanFrame: { width: 280, height: 180, borderWidth: 3, borderColor: '#00BBDD', borderStyle: 'dashed', borderRadius: 24, backgroundColor: 'transparent' },
  scanPill: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginTop: 16 },
  scanText: { color: '#15284C', fontSize: 13, fontWeight: '800' },
  lastPill: { backgroundColor: 'rgba(15,118,110,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  lastText: { color: 'white', fontSize: 11, fontWeight: '700' },
  noCam: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, minHeight: 220 },
  emptyBlob: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#CDE8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, color: '#15284C', letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20, fontWeight: '600', lineHeight: 20 },
  grantBtn: { backgroundColor: '#15284C', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16 },
  bottom: { padding: 16, paddingBottom: 110, backgroundColor: '#F5F8FB', gap: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  typeLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeInput: { flex: 1, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600', color: '#15284C' },
  lookupBtn: { backgroundColor: '#15284C', paddingHorizontal: 16, borderRadius: 16, justifyContent: 'center' },
  resultCard: { backgroundColor: 'white', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#CDE8F0' },
  resultKicker: { fontSize: 11, fontWeight: '800', color: '#00BBDD', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#15284C' },
  resultMeta: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4, marginBottom: 10 },
  flash: { fontSize: 12, fontWeight: '800', color: '#166534', marginBottom: 8 },
  resultActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  resultBtn: { backgroundColor: '#15284C', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  tipBox: { backgroundColor: 'white', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  tipTitle: { color: '#15284C', fontWeight: '800', marginBottom: 8, fontSize: 14 },
  tip: { color: '#475569', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 8, marginTop: 4 },
  btn: { backgroundColor: '#15284C', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, flex: 1, alignItems: 'center', shadowColor: '#15284C', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#CDE8F0', shadowOpacity: 0.04 },
  btnTertiary: { backgroundColor: '#1E4A7A' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 13 },
});


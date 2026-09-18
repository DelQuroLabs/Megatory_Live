import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { loadInventory } from '../lib/storage/inventoryStorage';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string>('');
  const router = useRouter();

  useEffect(() => { if (!permission?.granted) requestPermission(); }, [permission]);

  const handleBarcode = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    const data = result.data;
    if (!data) return;
    setScanned(true);
    setLastData(data);
    const inventory = await loadInventory();
    const existing = inventory.find(i => i.barcode === data);
    if (existing) {
      Alert.alert('Found', `${existing.drugName}\nCurrent: ${existing.quantityOnHand} ${existing.unit}\n\nAdd more?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
        { text: 'Add Quantity', onPress: () => router.replace({ pathname: '/add', params: { id: existing.id, mode: 'addQty', barcode: data } }) },
        { text: 'View/Edit', onPress: () => router.replace({ pathname: '/add', params: { id: existing.id } }) },
      ]);
    } else {
      Alert.alert('New barcode', `Barcode: ${data}\n\nNot found. Create new item?`, [
        { text: 'Rescan', style: 'cancel', onPress: () => setScanned(false) },
        { text: 'Create New', onPress: () => router.replace({ pathname: '/add', params: { barcode: data } }) },
      ]);
    }
  };

  if (!permission) return <View style={styles.center}><Text style={styles.sub}>Requesting camera permission...</Text></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyBlob}><Text style={{ fontSize: 36 }}>📷</Text></View>
        <Text style={styles.title}>Camera needed</Text>
        <Text style={styles.sub}>We need camera to scan med bottles</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnText}>Grant Permission</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.back()}><Text style={[styles.btnText, { color: '#15284C' }]}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr'] }} onBarcodeScanned={handleBarcode}>
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <View style={styles.scanPill}><Text style={styles.scanText}>Align barcode within frame 🎯</Text></View>
          {lastData ? <View style={styles.lastPill}><Text style={styles.lastText}>Last: {lastData}</Text></View> : null}
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Vet Med Tips 💡</Text>
            <Text style={styles.tip}>• NDC barcodes scan best in good light</Text>
            <Text style={styles.tip}>• If not found, you'll create manually</Text>
            <Text style={styles.tip}>• Qty you enter will ADD to count</Text>
          </View>
        </View>
      </CameraView>
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}><Text style={styles.btnText}>{scanned ? 'Scan Again' : 'Ready to Scan'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.back()}><Text style={[styles.btnText, { color: '#15284C' }]}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnTertiary]} onPress={() => router.replace({ pathname: '/add', params: { barcode: lastData || '' } })}><Text style={styles.btnText}>＋ Manual</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20 },
  scanFrame: { width: 280, height: 180, borderWidth: 3, borderColor: '#00BBDD', borderStyle: 'dashed', borderRadius: 24, backgroundColor: 'transparent' },
  scanPill: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, marginTop: 16 },
  scanText: { color: '#15284C', fontSize: 13, fontWeight: '800' },
  lastPill: { backgroundColor: 'rgba(15,118,110,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  lastText: { color: 'white', fontSize: 11, fontWeight: '700' },
  tipBox: { marginTop: 30, backgroundColor: 'rgba(255,255,255,0.92)', padding: 16, borderRadius: 20, width: '100%', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  tipTitle: { color: '#15284C', fontWeight: '800', marginBottom: 8, fontSize: 14 },
  tip: { color: '#475569', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  bottom: { padding: 16, paddingBottom: 28, backgroundColor: '#F5F8FB', flexDirection: 'row', justifyContent: 'space-around', gap: 8, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F8FB' },
  emptyBlob: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#CDE8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8, color: '#15284C', letterSpacing: -0.5 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  btn: { backgroundColor: '#15284C', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, flex: 1, alignItems: 'center', shadowColor: '#15284C', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#CDE8F0', shadowOpacity: 0.04 },
  btnTertiary: { backgroundColor: '#6366f1' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 13 },
});

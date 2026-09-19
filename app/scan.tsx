import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { InventoryItem, findItemByBarcode } from '../lib/domain/inventory';
import { loadInventory, saveInventory, loadMeta } from '../lib/storage/inventoryStorage';
import { WebBarcodeCamera, WebBarcodeCameraHandle } from '../components/WebBarcodeCamera';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [typed, setTyped] = useState('');
  const [lastData, setLastData] = useState('');
  const [lookedUp, setLookedUp] = useState(false);
  const [match, setMatch] = useState<InventoryItem | null>(null);
  const [flash, setFlash] = useState('');
  const [status, setStatus] = useState('Point at the bars — or tap Read barcode');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<WebBarcodeCameraHandle>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const nativeCamOn = !isWeb && Boolean(permission?.granted);

  useEffect(() => {
    if (!isWeb) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookup = async (data: string) => {
    const code = String(data || '').trim();
    if (!code) return;
    setLastData(code);
    setTyped(code);
    const inventory = await loadInventory();
    const existing = findItemByBarcode(inventory, code) || null;
    setMatch(existing);
    setLookedUp(true);
    setFlash('');
    setStatus(existing ? `Found ${existing.drugName || 'item'}` : 'Not in this phone’s list');
  };

  const resetScan = () => {
    setLookedUp(false);
    setMatch(null);
    setFlash('');
    setLastData('');
    setStatus('Point at the bars — or tap Read barcode');
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

  const captureNow = async () => {
    if (capturing) return;
    setCapturing(true);
    setStatus('Reading…');
    try {
      const code = await cameraRef.current?.capture();
      if (code) await lookup(code);
      else setStatus('Couldn’t read that. Get closer, more light, or type the number.');
    } catch {
      setStatus('Couldn’t read that. Type the number instead.');
    } finally {
      setCapturing(false);
    }
  };

  const onPhoto = async (file?: Blob | null) => {
    if (!file) return;
    setCapturing(true);
    setStatus('Reading photo…');
    try {
      const code = await cameraRef.current?.decodeFile(file);
      if (code) await lookup(code);
      else setStatus('Couldn’t read that photo. Type the number.');
    } catch {
      setStatus('Couldn’t read that photo. Type the number.');
    } finally {
      setCapturing(false);
    }
  };

  const handleNativeBarcode = (result: BarcodeScanningResult) => {
    if (lookedUp) return;
    if (!result?.data) return;
    lookup(result.data);
  };

  return (
    <View style={styles.container}>
      {isWeb ? (
        <WebBarcodeCamera
          ref={cameraRef}
          paused={lookedUp || capturing}
          onDetect={lookup}
          onStatus={setStatus}
        />
      ) : nativeCamOn ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr'] }}
          onBarcodeScanned={lookedUp ? undefined : handleNativeBarcode}
        />
      ) : (
        <View style={styles.noCamFill}>
          <Text style={styles.noCamTitle}>Type the bottle number</Text>
          <Text style={styles.noCamSub}>Camera is off. The number on the bottle still works.</Text>
          {permission && !permission.granted ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Grant camera permission" style={styles.grantBtn} onPress={requestPermission}>
              <Text style={styles.btnText}>Try Camera</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.chrome}>
        <View style={styles.frameWrap}>
          <View style={styles.frameDim} />
          <View style={styles.frameRow}>
            <View style={styles.frameDim} />
            <View style={styles.frame} />
            <View style={styles.frameDim} />
          </View>
          <View style={styles.frameDim} />
        </View>

        <View style={styles.sheet}>
          <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>

          <View style={styles.typeRow}>
            <TextInput
              style={styles.typeInput}
              value={typed}
              onChangeText={setTyped}
              placeholder="Or type the number"
              placeholderTextColor="#94a3b8"
              accessibilityLabel="Type barcode or manufacturer number"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => lookup(typed)}
            />
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Look up typed barcode" style={styles.lookupBtn} onPress={() => lookup(typed)}>
              <Text style={styles.btnText}>Go</Text>
            </TouchableOpacity>
          </View>

          {lookedUp ? (
            <View style={styles.resultCard}>
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
                  <Text style={styles.resultKicker}>Not in this phone’s list</Text>
                  <Text style={styles.resultTitle}>{lastData}</Text>
                  <Text style={styles.resultMeta}>Create it, or scan again. Dashes and extra zeros still match.</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Create new item from this barcode"
                    style={styles.resultBtn}
                    onPress={() => router.replace({ pathname: '/add', params: { barcode: lastData } })}
                  >
                    <Text style={styles.btnText}>Create</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan another barcode" style={styles.againBtn} onPress={resetScan}>
                <Text style={styles.againText}>Scan again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Read barcode now"
                accessibilityState={{ busy: capturing }}
                style={[styles.shutter, capturing && styles.shutterBusy]}
                onPress={isWeb ? captureNow : () => setStatus('Hold the bars inside the frame — this phone reads them by itself')}
                disabled={capturing}
              >
                <Text style={styles.shutterText}>{capturing ? 'Reading…' : 'Read barcode'}</Text>
              </TouchableOpacity>
              {isWeb ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo of the barcode"
                  style={styles.photoBtn}
                  onPress={() => fileRef.current?.click()}
                  disabled={capturing}
                >
                  <Text style={styles.photoText}>Take photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {isWeb
        ? React.createElement('input', {
            ref: (node: HTMLInputElement | null) => {
              fileRef.current = node;
            },
            type: 'file',
            accept: 'image/*',
            capture: 'environment',
            style: { display: 'none' },
            onChange: (e: any) => {
              const file = e?.target?.files?.[0];
              onPhoto(file);
              if (e?.target) e.target.value = '';
            },
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  chrome: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  frameWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', pointerEvents: 'none' },
  frameRow: { flexDirection: 'row', height: 168 },
  frameDim: { flex: 1, backgroundColor: 'rgba(11,18,32,0.28)' },
  frame: {
    width: 280,
    height: 168,
    borderWidth: 3,
    borderColor: '#00BBDD',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: 'rgba(245,248,251,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 108,
    gap: 10,
  },
  status: { fontSize: 13, fontWeight: '800', color: '#15284C', textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#DCE8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#15284C',
  },
  lookupBtn: { backgroundColor: '#15284C', paddingHorizontal: 18, borderRadius: 16, justifyContent: 'center' },
  captureRow: { gap: 8 },
  shutter: {
    backgroundColor: '#15284C',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#15284C',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  shutterBusy: { opacity: 0.7 },
  shutterText: { color: 'white', fontWeight: '800', fontSize: 16 },
  photoBtn: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#CDE8F0',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  photoText: { color: '#15284C', fontWeight: '800', fontSize: 14 },
  resultCard: { backgroundColor: 'white', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#CDE8F0' },
  resultKicker: { fontSize: 11, fontWeight: '800', color: '#00BBDD', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#15284C' },
  resultMeta: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4, marginBottom: 10 },
  flash: { fontSize: 12, fontWeight: '800', color: '#166534', marginBottom: 8 },
  resultActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  resultBtn: { backgroundColor: '#15284C', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#CDE8F0' },
  againBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  againText: { color: '#1E4A7A', fontWeight: '800' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  noCamFill: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F8FB' },
  noCamTitle: { fontSize: 22, fontWeight: '800', color: '#15284C', marginBottom: 8, textAlign: 'center' },
  noCamSub: { fontSize: 14, color: '#64748b', textAlign: 'center', fontWeight: '600', marginBottom: 16 },
  grantBtn: { backgroundColor: '#15284C', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16 },
});

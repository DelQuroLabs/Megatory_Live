import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { loadInventory, saveInventory, loadMeta, saveMeta, clearInventory } from '../lib/storage/inventoryStorage';
import { generateExcelBuffer, parseExcelBuffer, downloadExcel } from '../lib/storage/excel';
import { InventoryItem, mergeInventories } from '../lib/domain/inventory';
import { ensureDir, listManagedFiles, deleteManagedFile, shareManagedFile, saveFileToManaged, arrayBufferToBase64, ManagedFile, formatFileSize } from '../lib/storage/fileManager';
import { BACKEND_BASE_URL } from '../lib/backend/config';
import { checkBackendHealth, BackendHealth } from '../lib/backend/api';

export default function ImportExportScreen() {
  const [status, setStatus] = useState<string>('Ready');
  const [deviceName, setDeviceName] = useState('Phone');
  const [mergeStrategy, setMergeStrategy] = useState<'add' | 'replace'>('add');
  const [lastImport, setLastImport] = useState<{ added: number; updated: number } | null>(null);
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const handleTestConnection = async () => {
    setCheckingHealth(true);
    const result = await checkBackendHealth();
    setHealth(result);
    setCheckingHealth(false);
  };

  const refreshFiles = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const files = await listManagedFiles();
      setManagedFiles(files);
    }
  }, []);

  useEffect(() => { loadMeta().then(m => setDeviceName(m.deviceName || 'Phone')); refreshFiles(); }, [refreshFiles]);
  useFocusEffect(useCallback(() => { refreshFiles(); }, [refreshFiles]));

  const handleSaveDeviceName = async () => {
    const meta = await loadMeta();
    await saveMeta({ ...meta, deviceName });
    setStatus(`Device saved: ${deviceName}`);
  };

  const handleExport = async () => {
    try {
      setStatus('Generating...');
      const items = await loadInventory();
      if (items.length === 0) { Alert.alert('Nothing to export', 'Add some items first'); setStatus('No items'); return; }
      const buffer = generateExcelBuffer(items);
      if (Platform.OS === 'web') { downloadExcel(items, `megatory-inventory-${deviceName}-${new Date().toISOString().slice(0,10)}.xlsx`); setStatus(`Exported ${items.length} items`); return; }
      await ensureDir();
      const fileName = `megatory-inventory-${deviceName}-${new Date().toISOString().slice(0,10)}-${Date.now()}.xlsx`;
      const base64 = arrayBufferToBase64(buffer);
      const uri = await saveFileToManaged(fileName, base64);
      await refreshFiles();
      setStatus(`Exported ${items.length} items to ${fileName}`);
      Alert.alert('Export saved', `${items.length} items saved as ${fileName}\n\nShare via Email/AirDrop?`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Share', onPress: async () => { try { await shareManagedFile(uri); } catch (e:any){ setStatus(`Share failed: ${e.message}`); } }},
      ]);
    } catch (e: any) { setStatus(`Export failed: ${e.message}`); Alert.alert('Export failed', e.message); }
  };

  const handleImport = async () => {
    try {
      setStatus('Picking file... 📁');
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', '*/*'], copyToCacheDirectory: true });
      if (res.canceled) { setStatus('Import canceled'); return; }
      const asset = res.assets[0];
      setStatus(`Reading ${asset.name}...`);
      let buffer: ArrayBuffer;
      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        buffer = await resp.arrayBuffer();
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const binaryString = global.atob ? global.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        buffer = bytes.buffer;
        await ensureDir();
        await saveFileToManaged(`imported-${asset.name}-${Date.now()}.xlsx`, base64);
        await refreshFiles();
      }
      const parsed = parseExcelBuffer(buffer);
      if (parsed.length === 0) { Alert.alert('No data', 'No rows found'); setStatus('No rows'); return; }
      const existing = await loadInventory();
      const { merged, added, updated } = mergeInventories(existing, parsed, mergeStrategy);
      await saveInventory(merged);
      setLastImport({ added, updated });
      setStatus(`Imported ${parsed.length}: ${added} new, ${updated} merged`);
      Alert.alert('Import complete', `${parsed.length} rows\n${added} new\n${updated} updated`);
    } catch (e: any) { setStatus(`Import failed: ${e.message}`); Alert.alert('Import failed', e.message); }
  };

  const handleShareFile = async (file: ManagedFile) => {
    try { if (Platform.OS !== 'web') { await shareManagedFile(file.uri); setStatus(`Shared ${file.name}`); } } catch (e:any){ setStatus(`Share failed: ${e.message}`); }
  };
  const handleDeleteFile = async (file: ManagedFile) => {
    Alert.alert('Delete file?', `${file.name}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteManagedFile(file.uri); await refreshFiles(); setStatus(`Deleted ${file.name}`); }}
    ]);
  };
  const handleClear = async () => {
    Alert.alert('Clear all?', 'Deletes local counts only. Files stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearInventory(); setStatus('Cleared'); }}
    ]);
  };
  const handleTemplateDownload = async () => {
    try {
      const buffer = generateExcelBuffer([]);
      if (Platform.OS === 'web') { downloadExcel([], 'megatory-inventory-TEMPLATE.xlsx'); setStatus('Template downloaded'); return; }
      const base64 = arrayBufferToBase64(buffer);
      const fileName = `megatory-template-${Date.now()}.xlsx`;
      const uri = await saveFileToManaged(fileName, base64);
      await refreshFiles();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setStatus('Template saved');
    } catch (e: any) { setStatus(`Template failed: ${e.message}`); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      <View style={[styles.card, styles.soft1]}>
        <Text style={styles.cardTitle}>📱 Device Identity</Text>
        <Text style={styles.cardDesc}>Name this phone so merges show who counted</Text>
        <TextInput style={styles.input} value={deviceName} onChangeText={setDeviceName} accessibilityLabel="Device name" placeholder="e.g. Pharmacy-iPad" placeholderTextColor="#94a3b8" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save device name" style={styles.btn} onPress={handleSaveDeviceName}><Text style={styles.btnText}>Save Device</Text></TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⇅ Import / Export</Text>
        <Text style={styles.cardDesc}>Only Name+Qty required. Smart matching by barcode then name 💫</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Export inventory to Excel" style={[styles.btn, styles.btnPrimary]} onPress={handleExport}><Text style={styles.btnText}>📤 Export to Excel</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Import Excel or CSV inventory" style={[styles.btn, styles.btnSecondary]} onPress={handleImport}><Text style={styles.btnText}>📥 Import Excel / CSV</Text></TouchableOpacity>
        <View style={styles.pillBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mergeStrategy === 'add' }} accessibilityLabel={`Merge mode Add quantities${mergeStrategy === 'add' ? ' (selected)' : ''}`} style={[styles.pillBtn, mergeStrategy === 'add' && styles.pillBtnActive]} onPress={() => setMergeStrategy('add')}><Text style={[styles.pillText, mergeStrategy === 'add' && styles.pillTextActive]}>Add qty</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mergeStrategy === 'replace' }} accessibilityLabel={`Merge mode Replace${mergeStrategy === 'replace' ? ' (selected)' : ''}`} style={[styles.pillBtn, mergeStrategy === 'replace' && styles.pillBtnActive]} onPress={() => setMergeStrategy('replace')}><Text style={[styles.pillText, mergeStrategy === 'replace' && styles.pillTextActive]}>Replace</Text></TouchableOpacity>
        </View>
        {lastImport && <View style={styles.resultBox}><Text style={styles.resultText}>Last import: {lastImport.added} new, {lastImport.updated} updated</Text></View>}
      </View>

      <View style={[styles.card, styles.soft2]}>
        <Text style={styles.cardTitle}>🛰️ Server</Text>
        <Text style={styles.cardDesc}>Counts are stored on this device. Server sync is not enabled until the API contract is confirmed.</Text>
        <Text style={styles.serverUrl}>{BACKEND_BASE_URL}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Test connection to server"
          accessibilityState={{ busy: checkingHealth }}
          style={styles.btn}
          onPress={handleTestConnection}
          disabled={checkingHealth}
        >
          <Text style={styles.btnText}>{checkingHealth ? 'Testing…' : 'Test Connection'}</Text>
        </TouchableOpacity>
        {health && (
          <View style={[styles.resultBox, !health.reachable && styles.resultBoxError]}>
            <Text
              style={[styles.resultText, !health.reachable && styles.resultTextError]}
              accessibilityRole="text"
            >
              {health.reachable
                ? `Reachable — ${health.status} (${health.latencyMs} ms)`
                : `Unreachable — ${health.reason}`}
            </Text>
          </View>
        )}
      </View>

      {Platform.OS !== 'web' && (
        <View style={[styles.card, styles.soft2]}>
          <Text style={styles.cardTitle}>📁 Files</Text>
          <Text style={styles.cardDesc}>Exports saved here for email, AirDrop, Drive</Text>
          {managedFiles.length === 0 ? <Text style={styles.small}>No files yet. Export to create file</Text> : managedFiles.map(file => (
            <View key={file.uri} style={styles.fileRow}>
              <View style={{ flex: 1 }}><Text style={styles.fileName}>{file.name}</Text><Text style={styles.fileMeta}>{formatFileSize(file.size)} • {new Date(file.modified*1000).toLocaleString()}</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Share ${file.name}`} style={styles.fileBtn} onPress={() => handleShareFile(file)}><Text style={styles.fileBtnText}>Share</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${file.name}`} style={[styles.fileBtn, styles.fileBtnDelete]} onPress={() => handleDeleteFile(file)}><Text style={styles.fileBtnText}>🗑️</Text></TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh saved files" style={[styles.btn, { marginTop: 12, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0' }]} onPress={refreshFiles}><Text style={[styles.btnText, { color: '#475569' }]}>Refresh</Text></TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🪄 Multi-Phone Flow</Text>
        <Text style={styles.step}>1️⃣ Each person counts (Name+Qty) on their phone</Text>
        <Text style={styles.step}>2️⃣ Export → file saved → Share</Text>
        <Text style={styles.step}>3️⃣ Collect files</Text>
        <Text style={styles.step}>4️⃣ Master: Import each with Add quantities</Text>
        <Text style={styles.step}>5️⃣ Final Export = compiled</Text>
      </View>

      <View style={[styles.card, styles.soft3]}>
        <Text style={styles.cardTitle}>📄 Template</Text>
        <Text style={styles.cardDesc}>Need column layout? Download empty template with Instructions</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Download empty inventory template" style={styles.btn} onPress={handleTemplateDownload}><Text style={styles.btnText}>Download Template</Text></TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Danger Zone</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear all local inventory counts" style={[styles.btn, styles.btnDanger]} onPress={handleClear}><Text style={styles.btnText}>🗑️ Clear Local (files stay)</Text></TouchableOpacity>
      </View>

      <View style={styles.statusBox}><Text style={styles.statusLabel}>Status</Text><Text style={styles.statusText}>{status}</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FB' },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  soft1: { backgroundColor: '#F0F7FE', borderColor: '#CDE8F0' },
  soft2: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  soft3: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#15284C', marginBottom: 4, letterSpacing: -0.3 },
  cardDesc: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 14, lineHeight: 18 },
  small: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  input: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0', borderRadius: 16, padding: 14, fontSize: 15, fontWeight: '600', marginBottom: 10, color: '#15284C' },
  btn: { backgroundColor: '#15284C', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 10, shadowColor: '#15284C', shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  btnPrimary: { backgroundColor: '#15284C' },
  btnSecondary: { backgroundColor: '#1E4A7A' },
  btnDanger: { backgroundColor: '#fff1f2', borderWidth: 1.5, borderColor: '#ffe4e6' },
  btnText: { color: 'white', fontWeight: '800', fontSize: 14, letterSpacing: -0.2 },
  pillBar: { flexDirection: 'row', backgroundColor: '#EEF6FB', borderRadius: 999, padding: 4, gap: 4, marginTop: 8, marginBottom: 8 },
  pillBtn: { flex: 1, padding: 10, borderRadius: 999, alignItems: 'center' },
  pillBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  pillTextActive: { color: '#15284C', fontWeight: '800' },
  resultBox: { backgroundColor: '#dcfce7', borderWidth: 1.5, borderColor: '#bbf7d0', borderRadius: 16, padding: 12, marginTop: 8 },
  resultText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  resultBoxError: { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },
  resultTextError: { color: '#9f1239' },
  serverUrl: { fontSize: 12, fontWeight: '700', color: '#15284C', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 10 },
  step: { fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: '600' },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF6FB', borderStyle: 'dashed' },
  fileName: { fontSize: 13, fontWeight: '700', color: '#15284C' },
  fileMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  fileBtn: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginLeft: 8 },
  fileBtnDelete: { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },
  fileBtnText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  statusBox: { backgroundColor: '#15284C', borderRadius: 20, padding: 14, marginBottom: 14 },
  statusLabel: { color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800', marginBottom: 6 },
  statusText: { color: '#DCE8F0', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '600' },
});

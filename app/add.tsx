import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InventoryItem, DrugForm, DrugCategory, Location, createEmptyItem, validateItem, COMMON_VET_DRUGS, generateId } from '../lib/domain/inventory';
import { loadInventory, saveInventory, loadMeta } from '../lib/storage/inventoryStorage';

const FORMS: DrugForm[] = ['Tablet', 'Capsule', 'Chewable', 'Liquid', 'Injectable', 'Ointment', 'Cream', 'Powder', 'Suspension', 'Solution', 'Spot-On', 'Collar', 'Other'];
const CATEGORIES: DrugCategory[] = ['Antibiotic', 'NSAID', 'Analgesic', 'Sedative/Anesthesia', 'Antiparasitic', 'Vaccine', 'Fluid', 'Controlled Substance', 'Compounded', 'Supplement', 'OTC', 'Other'];
const LOCATIONS: Location[] = ['Main Pharmacy', 'Surgery', 'Exam 1', 'Exam 2', 'Exam 3', 'Exam 4', 'ICU', 'Lab', 'Refrigerator', 'Controlled Cabinet', 'OTC Shelf', 'Warehouse', 'Other'];

export default function AddScreen() {
  const params = useLocalSearchParams<{ id?: string; barcode?: string; mode?: string }>();
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem>(() => createEmptyItem({ barcode: params.barcode || '' }));
  const [qtyToAdd, setQtyToAdd] = useState<string>('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [deviceName, setDeviceName] = useState('Phone');

  useEffect(() => {
    (async () => {
      const meta = await loadMeta();
      setDeviceName(meta.deviceName || 'Phone');
      if (params.id) {
        const inv = await loadInventory();
        const found = inv.find(i => i.id === params.id);
        if (found) {
          setItem(found);
          if (params.mode === 'addQty') setIsAddMode(true);
        }
      } else if (params.barcode) {
        setItem(prev => ({ ...prev, barcode: params.barcode || '' }));
      }
    })();
  }, [params.id, params.barcode]);

  const update = (field: keyof InventoryItem, value: any) => setItem(prev => ({ ...prev, [field]: value }));

  const handleSuggest = (drugName: string) => {
    const lower = drugName.trim().toLowerCase();
    if (!lower) return;
    const match = COMMON_VET_DRUGS.find(d => d.drugName?.toLowerCase().includes(lower));
    if (match) {
      setItem(prev => ({
        ...prev,
        genericName: (match.genericName as string) || prev.genericName,
        manufacturer: (match.manufacturer as string) || prev.manufacturer,
        concentration: (match.concentration as string) || prev.concentration,
        form: (match.form as DrugForm) || prev.form,
        category: (match.category as DrugCategory) || prev.category,
        unit: (match.unit as string) || prev.unit,
        packageSize: (match.packageSize as string) || prev.packageSize,
        controlled: (match.controlled as boolean) || prev.controlled,
        controlledSchedule: (match.controlledSchedule as string) || prev.controlledSchedule,
      }));
    }
  };

  const handleSave = async () => {
    const errors = validateItem(item);
    if (errors.length) { Alert.alert('Fix errors', errors.join('\n')); return; }
    const inv = await loadInventory();
    let newItem: InventoryItem = { ...item };
    if (isAddMode) {
      const addQty = Number(qtyToAdd);
      if (!qtyToAdd.trim() || !Number.isFinite(addQty) || addQty <= 0) { Alert.alert('Invalid quantity', 'Enter a positive number to add'); return; }
      newItem.quantityOnHand = (newItem.quantityOnHand || 0) + addQty;
      newItem.lastCountedAt = new Date().toISOString();
      newItem.countedBy = deviceName;
    } else {
      if (!newItem.id) newItem.id = generateId();
      newItem.lastCountedAt = new Date().toISOString();
      newItem.countedBy = newItem.countedBy || deviceName;
    }
    const idx = inv.findIndex(i => i.id === newItem.id);
    let newInv: InventoryItem[];
    if (idx >= 0) { newInv = [...inv]; newInv[idx] = newItem; } else { newInv = [...inv, newItem]; }
    await saveInventory(newInv);
    Alert.alert('Saved', `${newItem.drugName} - ${newItem.quantityOnHand} ${newItem.unit}`, [
      { text: 'Back to List', onPress: () => router.replace('/') },
      { text: 'Scan Next', onPress: () => router.replace('/scan') },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      {isAddMode && (
        <View style={styles.addModeBanner}>
          <Text style={styles.addModeTitle}>Add Quantity Mode</Text>
          <Text style={styles.addModeText}>Current: {item.quantityOnHand} {item.unit}. Enter amount to ADD.</Text>
          <TextInput style={styles.qtyInput} value={qtyToAdd} onChangeText={setQtyToAdd} placeholder="Qty to add" accessibilityLabel="Quantity to add" keyboardType="numeric" autoFocus />
          <View style={styles.row}>
            {['1','2','5','10'].map(n => (
              <TouchableOpacity key={n} accessibilityRole="button" accessibilityLabel={`Add ${n} quantity`} style={styles.chip} onPress={() => setQtyToAdd(n)}><Text style={styles.chipText}>+{n}</Text></TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Only Name + Qty required 💫</Text>
        <Text style={styles.sectionSub}>Everything else optional — smart-matched to template</Text>
        <Field label="Drug Name *" value={item.drugName} onChange={(v: string) => { update('drugName', v); handleSuggest(v); }} placeholder="e.g. Cerenia, Carprofen" />
        <Field label="Barcode (optional)" value={item.barcode} onChange={(v: string) => update('barcode', v)} placeholder="helps matching" />
        <Field label="Generic (optional)" value={item.genericName} onChange={(v: string) => update('genericName', v)} placeholder="optional" />
        <Field label="Manufacturer" value={item.manufacturer} onChange={(v: string) => update('manufacturer', v)} placeholder="optional" />
        <Field label="Strength" value={item.concentration} onChange={(v: string) => update('concentration', v)} placeholder="e.g. 100mg" />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Form</Text>
        <View style={styles.chipRow}>{FORMS.map(f => (<TouchableOpacity key={f} accessibilityRole="button" accessibilityState={{ selected: item.form === f }} accessibilityLabel={`Form ${f}${item.form === f ? ' (selected)' : ''}`} style={[styles.chip, item.form === f && styles.chipActive]} onPress={() => update('form', f)}><Text style={[styles.chipText, item.form === f && styles.chipTextActive]}>{f}</Text></TouchableOpacity>))}</View>
        <Field label="Package Size" value={item.packageSize} onChange={(v: string) => update('packageSize', v)} placeholder="optional" />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>{CATEGORIES.map(c => (<TouchableOpacity key={c} accessibilityRole="button" accessibilityState={{ selected: item.category === c }} accessibilityLabel={`Category ${c}${item.category === c ? ' (selected)' : ''}`} style={[styles.chip, item.category === c && styles.chipActive]} onPress={() => update('category', c)}><Text style={[styles.chipText, item.category === c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>))}</View>
        <Text style={styles.label}>Location</Text>
        <View style={styles.chipRow}>{LOCATIONS.map(l => (<TouchableOpacity key={l} accessibilityRole="button" accessibilityState={{ selected: item.location === l }} accessibilityLabel={`Location ${l}${item.location === l ? ' (selected)' : ''}`} style={[styles.chip, item.location === l && styles.chipActive]} onPress={() => update('location', l)}><Text style={[styles.chipText, item.location === l && styles.chipTextActive]}>{l}</Text></TouchableOpacity>))}</View>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="Expiration" value={item.expirationDate} onChange={(v: string) => update('expirationDate', v)} placeholder="YYYY-MM-DD" /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><Field label="Lot" value={item.lotNumber} onChange={(v: string) => update('lotNumber', v)} placeholder="Lot #" /></View>
        </View>
        {!isAddMode && <Field label="Quantity On Hand * (required)" value={String(item.quantityOnHand)} onChange={(v: string) => update('quantityOnHand', Number(v) || 0)} placeholder="0" keyboardType="numeric" />}
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="Unit" value={item.unit} onChange={(v: string) => update('unit', v)} placeholder="bottle" /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><Field label="Counted By" value={item.countedBy} onChange={(v: string) => update('countedBy', v)} placeholder={deviceName} /></View>
        </View>
        <Field label="Notes" value={item.notes} onChange={(v: string) => update('notes', v)} placeholder="Optional notes" multiline />
      </View>

      <View style={styles.controlledCard}>
        <View style={styles.controlledHeader}><Text style={styles.controlledTitle}>Controlled Substance</Text><Switch accessibilityLabel="Controlled substance" value={item.controlled} onValueChange={v => update('controlled', v)} trackColor={{ false: '#DCE8F0', true: '#CDE8F0' }} thumbColor={item.controlled ? '#15284C' : '#F8FBFE'} /></View>
        <Text style={styles.controlledDesc}>For DEA scheduled items. Adds classification to export if needed.</Text>
        {item.controlled && <View style={{ marginTop: 12 }}><Field label="Schedule II-V" value={item.controlledSchedule || ''} onChange={(v: string) => update('controlledSchedule', v)} placeholder="e.g. II, III, IV, V" /></View>}
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel={isAddMode ? `Add ${qtyToAdd || '0'} quantity and save` : 'Save inventory item'} style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>{isAddMode ? `Add ${qtyToAdd || '0'}` : 'Save Item'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel and go back" style={styles.cancelBtn} onPress={() => router.back()}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { height: 70, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8" accessibilityLabel={label.replace(/\s*\*.*$/, '')} keyboardType={keyboardType || 'default'} multiline={!!multiline} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FB' },
  addModeBanner: { backgroundColor: '#fefce8', borderWidth: 1.5, borderColor: '#fde68a', borderRadius: 24, padding: 16 },
  addModeTitle: { fontWeight: '800', color: '#854d0e', fontSize: 16 },
  addModeText: { color: '#a16207', marginTop: 4, fontSize: 13, fontWeight: '600' },
  qtyInput: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#fde68a', borderRadius: 16, padding: 16, fontSize: 22, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  section: { backgroundColor: 'white', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#15284C', marginBottom: 4, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { backgroundColor: '#F8FBFE', borderWidth: 1.5, borderColor: '#DCE8F0', borderRadius: 16, padding: 14, fontSize: 15, fontWeight: '600', color: '#15284C' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14, gap: 8 },
  row: { flexDirection: 'row', marginTop: 10, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F8FBFE', borderWidth: 1.5, borderColor: '#DCE8F0' },
  chipActive: { backgroundColor: '#15284C', borderColor: '#15284C', shadowColor: '#15284C', shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: 'white', fontWeight: '800' },
  controlledCard: { backgroundColor: '#F8FBFE', borderWidth: 1.5, borderColor: '#DCE8F0', borderStyle: 'dashed', borderRadius: 20, padding: 16 },
  controlledHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlledTitle: { fontSize: 13, fontWeight: '800', color: '#334155' },
  controlledDesc: { fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: '600' },
  saveBtn: { backgroundColor: '#15284C', padding: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#15284C', shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 16, letterSpacing: -0.3 },
  cancelBtn: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0', padding: 16, borderRadius: 20, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '700' },
});

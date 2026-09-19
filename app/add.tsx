import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { InventoryItem, DrugForm, DrugCategory, Location, createEmptyItem, validateItem, COMMON_VET_DRUGS, generateId, SVP_GL_CATEGORIES, COUNT_TYPES, parseQuantity } from '../lib/domain/inventory';
import { loadInventory, saveInventory, loadMeta } from '../lib/storage/inventoryStorage';
import { loadPerson } from '../lib/kiosk/session';

const FORMS: DrugForm[] = ['Tablet', 'Capsule', 'Chewable', 'Liquid', 'Injectable', 'Ointment', 'Cream', 'Powder', 'Suspension', 'Solution', 'Spot-On', 'Collar', 'Other'];
const LOCATIONS: Location[] = ['Main Pharmacy', 'Surgery', 'Exam 1', 'Exam 2', 'Exam 3', 'Exam 4', 'ICU', 'Lab', 'Refrigerator', 'Controlled Cabinet', 'OTC Shelf', 'Warehouse', 'Other'];
const GL_OPTIONS = [...SVP_GL_CATEGORIES];
const FRACTION_CHIPS = ['0.25', '0.5', '0.75', '1', '1.75', '2'];

export default function AddScreen() {
  const params = useLocalSearchParams<{ id?: string; barcode?: string; mode?: string }>();
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem>(() => createEmptyItem({ barcode: params.barcode || '' }));
  const [qtyToAdd, setQtyToAdd] = useState<string>('');
  const [qtyText, setQtyText] = useState<string>('0');
  const [isAddMode, setIsAddMode] = useState(false);
  const [deviceName, setDeviceName] = useState('Phone');
  const [banner, setBanner] = useState<{ kind: 'error' | 'saved'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const meta = await loadMeta();
      const person = await loadPerson();
      setDeviceName(person?.name || meta.deviceName || 'Phone');
      if (params.id) {
        const inv = await loadInventory();
        const found = inv.find(i => i.id === params.id);
        if (found) {
          setItem(found);
          setQtyText(String(found.quantityOnHand ?? 0));
          if (params.mode === 'addQty') setIsAddMode(true);
        }
      } else if (params.barcode) {
        setItem(prev => ({ ...prev, barcode: params.barcode || '' }));
      }
    })();
  }, [params.id, params.barcode, params.mode]);

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
    const inv = await loadInventory();
    let newItem: InventoryItem = { ...item };
    if (isAddMode) {
      const addQty = parseQuantity(qtyToAdd);
      if (!qtyToAdd.trim() || addQty <= 0) {
        setBanner({ kind: 'error', text: 'Enter a positive number to add (fractions like 0.5 are OK)' });
        return;
      }
      newItem.quantityOnHand = (newItem.quantityOnHand || 0) + addQty;
      newItem.lastCountedAt = new Date().toISOString();
      newItem.countedBy = deviceName;
    } else {
      newItem.quantityOnHand = parseQuantity(qtyText);
      const errors = validateItem(newItem);
      if (errors.length) { setBanner({ kind: 'error', text: errors.join(' · ') }); return; }
      if (!newItem.id) newItem.id = generateId();
      newItem.lastCountedAt = new Date().toISOString();
      newItem.countedBy = newItem.countedBy || deviceName;
    }
    const idx = inv.findIndex(i => i.id === newItem.id);
    let newInv: InventoryItem[];
    if (idx >= 0) { newInv = [...inv]; newInv[idx] = newItem; } else { newInv = [...inv, newItem]; }
    await saveInventory(newInv);
    setItem(newItem);
    setQtyText(String(newItem.quantityOnHand ?? 0));
    setQtyToAdd('');
    setBanner({ kind: 'saved', text: `Saved ${newItem.drugName || 'item'} — ${newItem.quantityOnHand} ${newItem.unit} to the hospital notebook` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
      {banner && (
        <View style={[styles.banner, banner.kind === 'error' ? styles.bannerError : styles.bannerSaved]} accessibilityLiveRegion="polite">
          <Text style={banner.kind === 'error' ? styles.bannerErrorText : styles.bannerSavedText}>{banner.text}</Text>
          {banner.kind === 'saved' ? (
            <View style={styles.bannerActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to list" style={styles.saveBtn} onPress={() => router.replace('/')}>
                <Text style={styles.saveBtnText}>Back to list</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan next bottle" style={styles.cancelBtn} onPress={() => router.replace('/scan')}>
                <Text style={styles.cancelText}>Scan next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {isAddMode && (
        <View style={styles.addModeBanner}>
          <Text style={styles.addModeTitle}>Add Quantity Mode</Text>
          <Text style={styles.addModeText}>Current: {item.quantityOnHand} {item.unit}. Enter amount to ADD. Fractions like 1.75 are OK.</Text>
          <TextInput style={styles.qtyInput} value={qtyToAdd} onChangeText={setQtyToAdd} placeholder="Qty to add (1.75 is OK)" accessibilityLabel="Quantity to add" keyboardType="decimal-pad" autoFocus />
          <View style={styles.row}>
            {FRACTION_CHIPS.map(n => (
              <TouchableOpacity key={n} accessibilityRole="button" accessibilityLabel={`Add ${n} quantity`} style={styles.chip} onPress={() => setQtyToAdd(n)}><Text style={styles.chipText}>+{n}</Text></TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Only Name + Qty required 💫</Text>
        <Text style={styles.sectionSub}>Everything else optional — smart-matched to the hospital sheet</Text>
        <Field label="Drug Name *" value={item.drugName} onChange={(v: string) => { update('drugName', v); handleSuggest(v); }} placeholder="e.g. Cerenia, Carprofen" />
        <Field label="Manufacturer Number / Barcode" value={item.barcode} onChange={(v: string) => update('barcode', v)} placeholder="helps matching" />
        <Field label="Manufacturer" value={item.manufacturer} onChange={(v: string) => update('manufacturer', v)} placeholder="optional" />
        <Text style={styles.label}>SVP GL (hospital category)</Text>
        <View style={styles.chipRow}>{GL_OPTIONS.map(g => (
          <TouchableOpacity key={g} accessibilityRole="button" accessibilityState={{ selected: item.svpGl === g }} accessibilityLabel={`SVP GL ${g}${item.svpGl === g ? ' (selected)' : ''}`} style={[styles.chip, item.svpGl === g && styles.chipActive]} onPress={() => update('svpGl', g)}>
            <Text style={[styles.chipText, item.svpGl === g && styles.chipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}</View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Pack type</Text>
        <View style={styles.chipRow}>{FORMS.map(f => (<TouchableOpacity key={f} accessibilityRole="button" accessibilityState={{ selected: item.form === f }} accessibilityLabel={`Form ${f}${item.form === f ? ' (selected)' : ''}`} style={[styles.chip, item.form === f && styles.chipActive]} onPress={() => update('form', f)}><Text style={[styles.chipText, item.form === f && styles.chipTextActive]}>{f}</Text></TouchableOpacity>))}</View>
        <Field label="Pack units" value={item.packUnits} onChange={(v: string) => update('packUnits', v)} placeholder="e.g. 100, 10, 12" keyboardType="decimal-pad" />
        <Text style={styles.label}>Count type</Text>
        <View style={styles.chipRow}>{COUNT_TYPES.map(t => (
          <TouchableOpacity key={t} accessibilityRole="button" accessibilityState={{ selected: item.countType === t }} accessibilityLabel={`Count type ${t}${item.countType === t ? ' (selected)' : ''}`} style={[styles.chip, item.countType === t && styles.chipActive]} onPress={() => update('countType', t)}>
            <Text style={[styles.chipText, item.countType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}</View>
        <Text style={styles.label}>Location</Text>
        <View style={styles.chipRow}>{LOCATIONS.map(l => (<TouchableOpacity key={l} accessibilityRole="button" accessibilityState={{ selected: item.location === l }} accessibilityLabel={`Location ${l}${item.location === l ? ' (selected)' : ''}`} style={[styles.chip, item.location === l && styles.chipActive]} onPress={() => update('location', l)}><Text style={[styles.chipText, item.location === l && styles.chipTextActive]}>{l}</Text></TouchableOpacity>))}</View>
      </View>

      <View style={styles.section}>
        {!isAddMode && (
          <>
            <Field label="Count * (fractions OK)" value={qtyText} onChange={setQtyText} placeholder="1.75" keyboardType="decimal-pad" />
            <View style={styles.row}>
              {FRACTION_CHIPS.map(n => (
                <TouchableOpacity key={n} accessibilityRole="button" accessibilityLabel={`Set count to ${n}`} style={styles.chip} onPress={() => setQtyText(n)}><Text style={styles.chipText}>{n}</Text></TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="Counted By" value={item.countedBy} onChange={(v: string) => update('countedBy', v)} placeholder={deviceName} /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><Field label="Notes" value={item.notes} onChange={(v: string) => update('notes', v)} placeholder="optional" /></View>
        </View>
      </View>

      <View style={styles.controlledCard}>
        <View style={styles.controlledHeader}><Text style={styles.controlledTitle}>Controlled Substance (DEA)</Text><Switch accessibilityLabel="Controlled substance" value={item.controlled} onValueChange={v => update('controlled', v)} trackColor={{ false: '#DCE8F0', true: '#CDE8F0' }} thumbColor={item.controlled ? '#15284C' : '#F8FBFE'} /></View>
        <Text style={styles.controlledDesc}>Exact pills or milliliters in COUNT. Then put the paper-log balance in LOG #1.</Text>
        {item.controlled && (
          <View style={{ marginTop: 12 }}>
            <Field label="Schedule II-V" value={item.controlledSchedule || ''} onChange={(v: string) => update('controlledSchedule', v)} placeholder="e.g. II, III, IV, V" />
            <Field label="LOG #1 (required) — balance on your controlled log" value={item.log1} onChange={(v: string) => update('log1', v)} placeholder="number from the paper log" keyboardType="decimal-pad" />
          </View>
        )}
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
  row: { flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' },
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
  banner: { borderRadius: 24, padding: 16, borderWidth: 1.5 },
  bannerError: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  bannerSaved: { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
  bannerErrorText: { color: '#9f1239', fontWeight: '700', fontSize: 14 },
  bannerSavedText: { color: '#166534', fontWeight: '800', fontSize: 14 },
  bannerActions: { marginTop: 12, gap: 8 },
});

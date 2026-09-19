import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { InventoryItem, normalizeBarcode } from '../lib/domain/inventory';
import { loadInventory, saveInventory, loadMeta } from '../lib/storage/inventoryStorage';

export default function InventoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [showUncounted, setShowUncounted] = useState(false);
  const [deviceName, setDeviceName] = useState('Phone');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const loaded = await loadInventory();
    setItems(loaded);
    const meta = await loadMeta();
    if (meta.deviceName) setDeviceName(meta.deviceName);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    const nb = normalizeBarcode(search);
    const matchesSearch = !s || i.drugName.toLowerCase().includes(s) || i.genericName.toLowerCase().includes(s) || i.barcode.includes(s) || (nb && normalizeBarcode(i.barcode).includes(nb)) || i.manufacturer.toLowerCase().includes(s) || (i.svpGl || '').toLowerCase().includes(s);
    const matchesLocation = filterLocation === 'All' || i.location === filterLocation || i.svpGl === filterLocation;
    const matchesCounted = !!s || showUncounted || (i.quantityOnHand || 0) !== 0;
    return matchesSearch && matchesLocation && matchesCounted;
  });

  const countedCount = items.filter(i => (i.quantityOnHand || 0) !== 0).length;
  const locations = ['All', ...Array.from(new Set(items.map(i => i.svpGl || i.location).filter(Boolean)))];

  const handleAddOne = async (id: string) => {
    const next = items.map(i =>
      i.id === id
        ? { ...i, quantityOnHand: (i.quantityOnHand || 0) + 1, lastCountedAt: new Date().toISOString() }
        : i,
    );
    setItems(next);
    await saveInventory(next);
  };

  const confirmDelete = async (id: string) => {
    const newItems = items.filter(x => x.id !== id);
    setItems(newItems);
    setPendingDeleteId(null);
    await saveInventory(newItems);
  };

  const renderItem = ({ item }: { item: InventoryItem }) => (
    // Plain View, not a TouchableOpacity: the card used to wrap the
    // +1 / Edit / delete controls, which renders <button> inside <button> on
    // the web target (invalid DOM nesting and an a11y violation). The Edit
    // control already performs the exact same navigation, so nothing is lost.
    <View
      style={styles.card}
      accessibilityLabel={`${item.drugName || 'Unnamed drug'}, ${item.quantityOnHand} ${item.unit} on hand`}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.drugName}>{item.drugName || 'Unnamed Drug'}</Text>
          <Text style={styles.meta}>{item.barcode ? `${item.barcode}` : 'No barcode'} • {item.svpGl || item.location} • {item.form}</Text>
        </View>
        <View style={styles.qtyBubble}>
          <Text style={styles.qtyText}>{item.quantityOnHand}</Text>
          <Text style={styles.qtyUnit}>{item.unit}</Text>
        </View>
      </View>
      {item.genericName ? <Text style={styles.generic}>{item.genericName} {item.concentration ? `• ${item.concentration}` : ''}</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.btnBubble}
          onPress={() => handleAddOne(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Add one ${item.drugName || 'unnamed drug'}`}
        >
          <Text style={styles.btnBubbleText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnBubble, styles.btnBubbleSecondary]}
          onPress={() => router.push({ pathname: '/add', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.drugName || 'unnamed drug'}`}
        >
          <Text style={[styles.btnBubbleText, { color: '#15284C' }]}>Edit</Text>
        </TouchableOpacity>
        {pendingDeleteId === item.id ? (
          <>
            <TouchableOpacity
              style={[styles.btnBubble, styles.btnBubbleDanger]}
              onPress={() => confirmDelete(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Confirm delete ${item.drugName || 'unnamed drug'} from this device count`}
            >
              <Text style={styles.btnBubbleText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnBubble, styles.btnBubbleGhost]}
              onPress={() => setPendingDeleteId(null)}
              accessibilityRole="button"
              accessibilityLabel={`Keep ${item.drugName || 'unnamed drug'}`}
            >
              <Text style={[styles.btnBubbleText, { color: '#15284C' }]}>Keep</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.btnBubble, styles.btnBubbleGhost]}
            onPress={() => setPendingDeleteId(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.drugName || 'unnamed drug'} from this device count`}
          >
            <Text style={[styles.btnBubbleText, { color: '#94a3b8' }]}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.pill}><Text style={styles.pillText}>📱 {deviceName}</Text></View>
        <View style={styles.pill}><Text style={styles.pillText}> {countedCount} counted • {items.length} in sheet • this phone</Text></View>
        <TouchableOpacity
          style={[styles.pill, showUncounted && styles.pillActive]}
          onPress={() => setShowUncounted(v => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: showUncounted }}
          accessibilityLabel={showUncounted ? 'Showing all catalog items (selected)' : 'Show all catalog items including uncounted'}
        >
          <Text style={[styles.pillText, showUncounted && styles.pillTextActive]}>{showUncounted ? 'All items' : 'Counted only'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search meds, barcode, brand..."
          accessibilityLabel="Search inventory by drug name, barcode, or brand"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={locations}
          keyExtractor={l => l}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: loc }) => (
            <TouchableOpacity
              style={[styles.filterChip, filterLocation === loc && styles.filterChipActive]}
              onPress={() => setFilterLocation(loc)}
              accessibilityRole="button"
              accessibilityState={{ selected: filterLocation === loc }}
              // accessibilityState.selected is not surfaced as aria-selected by
              // react-native-web 0.19, so the state is also carried in the
              // accessible label to stay announced on the web target.
              accessibilityLabel={`Filter by location ${loc}${filterLocation === loc ? ' (selected)' : ''}`}
            >
              <Text style={[styles.filterChipText, filterLocation === loc && styles.filterChipTextActive]}>{loc}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyBlob}><Text style={{ fontSize: 40 }}>📦</Text></View>
          <Text style={styles.emptyTitle}>{items.length ? 'Nothing counted yet' : 'No stock yet'}</Text>
          <Text style={styles.emptyText}>{items.length ? `${items.length} items are waiting in the hospital sheet. Scan or search to start filling COUNT. Saved on this phone only.` : 'Scan a bottle or add manually. Counts stay on this phone — Files has a QR for other phones.'}</Text>
          <View style={styles.emptyActions}>
            <Link href="/scan" asChild>
              <TouchableOpacity style={styles.primaryBtn} accessibilityRole="button" accessibilityLabel="Scan a bottle barcode">
                <Text style={styles.primaryBtnText}>📷 Scan</Text>
              </TouchableOpacity>
            </Link>
            <Link href="/add" asChild>
              <TouchableOpacity style={styles.secondaryBtn} accessibilityRole="button" accessibilityLabel="Add an item manually">
                <Text style={styles.secondaryBtnText}>＋ Add</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      ) : (
        <FlatList data={filtered} keyExtractor={i => i.id} renderItem={renderItem} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8FB' },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingHorizontal: 16 },
  pill: { backgroundColor: 'white', borderWidth: 1, borderColor: '#DCE8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  pillActive: { backgroundColor: '#15284C', borderColor: '#15284C' },
  pillText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  pillTextActive: { color: 'white' },
  searchWrap: { marginHorizontal: 16, marginBottom: 12, backgroundColor: 'white', borderRadius: 999, borderWidth: 1.5, borderColor: '#DCE8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  searchIcon: { fontSize: 16, marginRight: 8, opacity: 0.6 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: '600', color: '#15284C' },
  filterRow: { paddingBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#DCE8F0' },
  filterChipActive: { backgroundColor: '#15284C', borderColor: '#15284C', shadowColor: '#15284C', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  filterChipTextActive: { color: 'white', fontWeight: '800' },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  drugName: { fontSize: 16, fontWeight: '800', color: '#15284C', letterSpacing: -0.3 },
  generic: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4 },
  meta: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  qtyBubble: { backgroundColor: '#F0F7FE', borderWidth: 1.5, borderColor: '#CDE8F0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', minWidth: 64 },
  qtyText: { fontSize: 16, fontWeight: '800', color: '#15284C' },
  qtyUnit: { fontSize: 10, fontWeight: '700', color: '#00BBDD', textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btnBubble: { backgroundColor: '#15284C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, shadowColor: '#15284C', shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  btnBubbleSecondary: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#CDE8F0', shadowColor: '#000', shadowOpacity: 0.04 },
  btnBubbleGhost: { backgroundColor: '#F8FBFE', borderWidth: 1, borderColor: '#DCE8F0', shadowOpacity: 0 },
  btnBubbleDanger: { backgroundColor: '#9f1239', shadowColor: '#9f1239' },
  btnBubbleText: { fontSize: 12, fontWeight: '800', color: 'white' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyBlob: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#CDE8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#15284C', marginBottom: 6, letterSpacing: -0.5 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20, fontWeight: '600', lineHeight: 20 },
  emptyActions: { flexDirection: 'row', gap: 12 },
  primaryBtn: { backgroundColor: '#15284C', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, shadowColor: '#15284C', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  primaryBtnText: { color: 'white', fontWeight: '800' },
  secondaryBtn: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#CDE8F0', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16 },
  secondaryBtnText: { color: '#15284C', fontWeight: '800' },
});

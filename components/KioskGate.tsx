import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { CANONICAL_APP_URL } from '../lib/share/appUrl';
import { normalizeHospital } from '../lib/kiosk/crypto';
import {
  forgetClock,
  kioskUrl,
  loadPerson,
  loadRegistration,
  lockClock,
  parseKioskQuery,
  registerClock,
  signInPerson,
  subscribeKiosk,
  KioskRegistration,
  KioskPerson,
} from '../lib/kiosk/session';
import { openHospitalNotebook, pushNotebook } from '../lib/kiosk/notebook';
import { loadCachedInventory, loadMeta, saveInventory, saveMeta } from '../lib/storage/inventoryStorage';
import { InventoryItem } from '../lib/domain/inventory';

type Props = { children: React.ReactNode };

export function KioskGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [reg, setReg] = useState<KioskRegistration | null>(null);
  const [person, setPerson] = useState<KioskPerson | null>(null);

  const refresh = async () => {
    const r = await loadRegistration();
    const p = await loadPerson();
    setReg(r);
    setPerson(p);
    setReady(true);
  };

  useEffect(() => {
    refresh();
    return subscribeKiosk(() => { refresh(); });
  }, []);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#00BBDD" />
      </View>
    );
  }

  if (!reg) return <RegisterClock onDone={refresh} />;
  if (!person) return <SignInClock registration={reg} onDone={refresh} />;
  return <View style={styles.fill}>{children}</View>;
}

export function useKioskHeader(): { label: string; onLock: () => void } {
  const [label, setLabel] = useState('Clock');
  useEffect(() => {
    const read = async () => {
      const r = await loadRegistration();
      const p = await loadPerson();
      if (r && p) setLabel(`${p.name} · ${r.hospitalCode}`);
      else if (r) setLabel(r.hospitalCode);
    };
    read();
    return subscribeKiosk(read);
  }, []);
  return { label, onLock: () => { lockClock(); } };
}

function inviteFromUrl(): { hospitalCode?: string; blobId?: string } {
  if (typeof window === 'undefined') return {};
  return parseKioskQuery(window.location.search || '');
}

function RegisterClock({ onDone }: { onDone: () => void }) {
  const invite = inviteFromUrl();
  const joining = Boolean(invite.blobId);
  const [hospital, setHospital] = useState(invite.hospitalCode || '');
  const [clockName, setClockName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [allowLocal, setAllowLocal] = useState(false);

  const finish = async (code: string, blobId: string, items: InventoryItem[], localOnly: boolean) => {
    const registered = await registerClock({ hospitalCode: code, clockName: clockName.trim(), sitePin: pin, blobId });
    if (items.length) await saveInventory(items, { localOnly: true });
    else {
      const cached = await loadCachedInventory();
      if (cached.length && !localOnly) await pushNotebook(registered, cached);
    }
    const meta = await loadMeta();
    await saveMeta({ ...meta, deviceName: clockName.trim(), hospitalCode: code });
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const next = kioskUrl(window.location.origin, { hospitalCode: code, blobId });
      window.history.replaceState({}, '', next);
    }
    onDone();
  };

  const submit = async (forceLocal = false) => {
    const code = normalizeHospital(hospital);
    if (code.length < 3) { setError('Hospital code is the short name (e.g. OAKVW)'); return; }
    if (clockName.trim().length < 2) { setError('Name this clock (e.g. Pharmacy iPad)'); return; }
    if (!/^\d{4,8}$/.test(pin)) { setError('Site PIN is 4–8 digits — same code on every clock'); return; }
    setBusy(true);
    setError('');
    try {
      if (forceLocal) {
        await finish(code, `local:${Date.now()}`, [], true);
        return;
      }
      const opened = await openHospitalNotebook({ hospitalCode: code, sitePin: pin });
      await finish(code, opened.blobId, opened.items, false);
    } catch (e: any) {
      setAllowLocal(true);
      setError(e?.message || 'Could not reach the hospital notebook. Check Wi‑Fi and try again, or continue on this clock only.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenInner} keyboardShouldPersistTaps="handled" accessibilityLabel="Register this clock">
      <Text style={styles.brand}>Megatory Live</Text>
      <Text style={styles.title}>{joining ? 'Join this hospital clock' : 'Register this clock'}</Text>
      <Text style={styles.sub}>
        {joining
          ? 'Same hospital code and site PIN as the other clock. Then every phone shares one notebook.'
          : 'Like Dayforce WebClock: hospital code, clock name, site PIN. Other phones type the same hospital code and PIN — that opens the same notebook.'}
      </Text>

      <Text style={styles.label}>Hospital code</Text>
      <TextInput
        style={styles.input}
        value={hospital}
        onChangeText={t => setHospital(t.toUpperCase())}
        placeholder="OAKVW"
        placeholderTextColor="#94a3b8"
        autoCapitalize="characters"
        accessibilityLabel="Hospital code"
      />

      <Text style={styles.label}>Clock name</Text>
      <TextInput
        style={styles.input}
        value={clockName}
        onChangeText={setClockName}
        placeholder="Pharmacy iPad"
        placeholderTextColor="#94a3b8"
        accessibilityLabel="Clock name"
      />

      <Text style={styles.label}>Site PIN</Text>
      <Text style={styles.pinDots} accessibilityLabel={`PIN length ${pin.length}`}>{pin.replace(/./g, '● ') || ' '}</Text>
      <PinPad value={pin} onChange={setPin} max={8} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={joining ? 'Join clock' : 'Register clock'}
        accessibilityState={{ busy }}
        style={[styles.primary, busy && styles.disabled]}
        onPress={() => submit(false)}
        disabled={busy}
      >
        <Text style={styles.primaryText}>{busy ? 'Connecting…' : joining ? 'Join clock' : 'Register clock'}</Text>
      </TouchableOpacity>
      {allowLocal ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Continue on this clock only"
          style={styles.linkBtn}
          onPress={() => submit(true)}
          disabled={busy}
        >
          <Text style={styles.linkText}>Continue on this clock only</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function SignInClock({ registration, onDone }: { registration: KioskRegistration; onDone: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    if (name.trim().length < 2) { setError('Type who is counting'); return; }
    setBusy(true);
    setError('');
    try {
      await signInPerson(name.trim());
      const meta = await loadMeta();
      await saveMeta({
        ...meta,
        deviceName: name.trim(),
        hospitalCode: registration.hospitalCode,
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenInner} keyboardShouldPersistTaps="handled" accessibilityLabel="Sign in to count">
      <Text style={styles.brand}>Megatory Live</Text>
      <Text style={styles.kicker}>{registration.hospitalCode}</Text>
      <Text style={styles.title}>{registration.clockName}</Text>
      <Text style={styles.sub}>Who is counting? Walk-up sign-in — like a time clock.</Text>

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Alex"
        placeholderTextColor="#94a3b8"
        autoFocus
        accessibilityLabel="Your name"
        onSubmitEditing={start}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Start counting"
        style={[styles.primary, busy && styles.disabled]}
        onPress={start}
        disabled={busy}
      >
        <Text style={styles.primaryText}>{busy ? '…' : 'Start counting'}</Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Forget this clock" style={styles.linkBtn} onPress={() => forgetClock().then(onDone)}>
        <Text style={styles.linkText}>Not this hospital — forget this clock</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PinPad({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: number }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={styles.pad}>
      {keys.map((k, i) => (
        <TouchableOpacity
          key={`${k}-${i}`}
          accessibilityRole={k ? 'button' : undefined}
          accessibilityLabel={k === '⌫' ? 'Delete last PIN digit' : k ? `PIN digit ${k}` : undefined}
          style={[styles.padKey, !k && styles.padEmpty]}
          disabled={!k}
          onPress={() => {
            if (k === '⌫') onChange(value.slice(0, -1));
            else if (value.length < max) onChange(value + k);
          }}
        >
          <Text style={styles.padKeyText}>{k}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function kioskShareUrl(reg: KioskRegistration | null): string {
  if (!reg) return CANONICAL_APP_URL;
  return kioskUrl(CANONICAL_APP_URL, reg);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { flex: 1, backgroundColor: '#15284C', alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: '#15284C' },
  screenInner: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, flexGrow: 1 },
  brand: { color: '#00BBDD', fontWeight: '800', fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  kicker: { color: '#00BBDD', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  title: { color: 'white', fontWeight: '800', fontSize: 28, letterSpacing: -0.6, marginBottom: 8 },
  sub: { color: '#CDE8F0', fontWeight: '600', fontSize: 14, lineHeight: 20, marginBottom: 22 },
  label: { color: '#94a3b8', fontWeight: '800', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#15284C',
    marginBottom: 14,
  },
  pinDots: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 6, textAlign: 'center', marginBottom: 8, minHeight: 28 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  padKey: {
    width: '31%',
    height: 56,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padEmpty: { backgroundColor: 'transparent' },
  padKeyText: { color: 'white', fontSize: 22, fontWeight: '800' },
  primary: { backgroundColor: '#00BBDD', paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
  primaryText: { color: '#15284C', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { color: '#fecdd3', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  linkBtn: { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
});

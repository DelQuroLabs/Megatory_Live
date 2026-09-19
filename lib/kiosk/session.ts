import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeHospital } from './crypto';
export { kioskUrl, parseKioskQuery } from './url';

export const KIOSK_KEY = 'megatory_live_kiosk_v1';
export const PERSON_KEY = 'megatory_live_person_v1';

export type KioskRegistration = {
  hospitalCode: string;
  clockName: string;
  sitePin: string;
  blobId: string;
  registeredAt: string;
};

export type KioskPerson = {
  name: string;
  signedInAt: string;
};

let registrationMem: KioskRegistration | null | undefined;
let personMem: KioskPerson | null | undefined;
const listeners = new Set<() => void>();

/** Test helper. */
export function resetKioskMemory() {
  registrationMem = undefined;
  personMem = undefined;
}

export function subscribeKiosk(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit() {
  listeners.forEach(fn => fn());
}

export async function loadRegistration(): Promise<KioskRegistration | null> {
  if (registrationMem !== undefined) return registrationMem;
  try {
    const raw = await AsyncStorage.getItem(KIOSK_KEY);
    registrationMem = raw ? JSON.parse(raw) : null;
  } catch {
    registrationMem = null;
  }
  return registrationMem ?? null;
}

export async function loadPerson(): Promise<KioskPerson | null> {
  if (personMem !== undefined) return personMem;
  try {
    const raw = await AsyncStorage.getItem(PERSON_KEY);
    personMem = raw ? JSON.parse(raw) : null;
  } catch {
    personMem = null;
  }
  return personMem ?? null;
}

export async function registerClock(input: { hospitalCode: string; clockName: string; sitePin: string; blobId: string }): Promise<KioskRegistration> {
  const reg: KioskRegistration = {
    hospitalCode: normalizeHospital(input.hospitalCode),
    clockName: input.clockName.trim(),
    sitePin: input.sitePin,
    blobId: input.blobId,
    registeredAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KIOSK_KEY, JSON.stringify(reg));
  registrationMem = reg;
  emit();
  return reg;
}

export async function signInPerson(name: string): Promise<KioskPerson> {
  const person: KioskPerson = { name: name.trim(), signedInAt: new Date().toISOString() };
  await AsyncStorage.setItem(PERSON_KEY, JSON.stringify(person));
  personMem = person;
  emit();
  return person;
}

export async function lockClock(): Promise<void> {
  await AsyncStorage.removeItem(PERSON_KEY);
  personMem = null;
  emit();
}

export async function forgetClock(): Promise<void> {
  await AsyncStorage.multiRemove([KIOSK_KEY, PERSON_KEY]);
  registrationMem = null;
  personMem = null;
  emit();
}



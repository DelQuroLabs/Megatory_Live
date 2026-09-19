/**
 * A11Y-001 — automated accessibility assertions for the Inventory screen.
 *
 * The §5.1 matrix requires an *automated minimum* for A11Y-001 at the preview
 * phase, so these are executable assertions rather than a manual claim.
 *
 * react-native-web maps `accessibilityLabel` -> `aria-label` and
 * `accessibilityRole` -> `role`, so we can assert the accessible name a screen
 * reader would actually announce.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyItem, InventoryItem } from '../lib/domain/inventory';
import { resetKioskMemory } from '../lib/kiosk/session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (cb: () => void) => cb(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// eslint-disable-next-line import/first
import InventoryScreen from '../app/index';

const INVENTORY_KEY = 'megatory_live_inventory_v1';

function seed(items: InventoryItem[]) {
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
    key === INVENTORY_KEY ? JSON.stringify(items) : null,
  );
}

describe('InventoryScreen accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKioskMemory();
    (AsyncStorage.getItem as jest.Mock).mockReset();
  });

  test('every rendered control exposes a non-empty accessible name', async () => {
    seed([
      createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12, unit: 'tablet' }),
    ]);
    const { container } = render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    const buttons = Array.from(
      container.querySelectorAll('[role="button"], button'),
    ) as HTMLElement[];

    expect(buttons.length).toBeGreaterThan(0);

    const unnamed = buttons.filter(el => {
      const name = (
        el.getAttribute('aria-label') ||
        el.textContent ||
        ''
      ).trim();
      return name.length === 0;
    });

    expect(unnamed).toEqual([]);
  });

  test('the delete control names the drug instead of relying on the 🗑️ emoji alone', async () => {
    seed([createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12 })]);
    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    const del = screen.getByRole('button', {
      name: /delete carprofen 100mg from this device count/i,
    });
    expect(del).toBeTruthy();
    // The emoji is still what sighted users see, but it is not the accessible name.
    expect((del.getAttribute('aria-label') || '').toLowerCase()).toContain('delete');
  });

  test('the +1 quick-count control announces what it adds', async () => {
    seed([createEmptyItem({ drugName: 'Meloxicam 1.5mg/mL', quantityOnHand: 3 })]);
    render(<InventoryScreen />);
    await screen.findByText('Meloxicam 1.5mg/mL');

    expect(
      screen.getByRole('button', { name: /add one meloxicam 1\.5mg\/ml/i }),
    ).toBeTruthy();
  });

  test('the search field is labelled for screen readers', async () => {
    seed([createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12 })]);
    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    expect(
      screen.getByLabelText(/search inventory by drug name, barcode, or brand/i),
    ).toBeTruthy();
  });

  test('the active location filter chip announces that it is selected', async () => {
    seed([
      createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12, location: 'Main Pharmacy' }),
    ]);
    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    // The default filter is "All", so that chip carries the selected marker.
    // react-native-web 0.19 does not map accessibilityState.selected to
    // aria-selected, so the app encodes the state in the accessible label.
    const selected = screen.getByRole('button', {
      name: /filter by location all \(selected\)/i,
    });
    expect(selected).toBeTruthy();

    // A non-active chip must NOT claim to be selected.
    const pharmacy = screen.getByRole('button', {
      name: /filter by location main pharmacy/i,
    });
    expect(pharmacy.getAttribute('aria-label') || '').not.toMatch(/selected/i);
  });

  test('no interactive control is nested inside another (invalid <button> in <button>)', async () => {
    seed([createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12 })]);
    const { container } = render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    const nested = Array.from(container.querySelectorAll('button button, [role="button"] [role="button"]'));
    expect(nested).toEqual([]);
  });
});

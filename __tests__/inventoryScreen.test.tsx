/**
 * COMPONENT-001 — real rendering tests for the Inventory screen.
 *
 * These render the actual `app/index.tsx` component (React + react-native-web
 * in jsdom — the renderer this app's declared `web-companion` target uses),
 * so they assert user-visible behaviour rather than re-testing the pure
 * domain helpers in inventory.test.ts.
 *
 * Covers REQ-006: "Inventory list with search/filter by name/barcode/location
 * and shows current counts."
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyItem, InventoryItem } from '../lib/domain/inventory';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useFocusEffect: (cb: () => void) => cb(),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Imported after the mocks above are registered.
// eslint-disable-next-line import/first
import InventoryScreen from '../app/index';

const INVENTORY_KEY = 'megatory_live_inventory_v1';

function seed(items: InventoryItem[]) {
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
    key === INVENTORY_KEY ? JSON.stringify(items) : null,
  );
}

const SEARCH_PLACEHOLDER = 'Search meds, barcode, brand...';

describe('InventoryScreen (rendered)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockReset();
  });

  test('shows the empty state when nothing has been counted', async () => {
    seed([]);
    render(<InventoryScreen />);
    expect(await screen.findByText('No stock yet')).toBeTruthy();
  });

  test('renders counted items with their quantity on hand', async () => {
    seed([
      createEmptyItem({ drugName: 'Carprofen 100mg', genericName: 'Carprofen', quantityOnHand: 12, unit: 'tablet', barcode: '300001111222' }),
      createEmptyItem({ drugName: 'Meloxicam 1.5mg/mL', quantityOnHand: 3, unit: 'bottle', barcode: '300003333444' }),
    ]);

    render(<InventoryScreen />);

    expect(await screen.findByText('Carprofen 100mg')).toBeTruthy();
    expect(screen.getByText('Meloxicam 1.5mg/mL')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  test('search narrows the list to the matching drug', async () => {
    seed([
      createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12, barcode: '300001111222' }),
      createEmptyItem({ drugName: 'Meloxicam 1.5mg/mL', quantityOnHand: 3, barcode: '300003333444' }),
    ]);

    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'melox' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Carprofen 100mg')).toBeNull();
    });
    expect(screen.getByText('Meloxicam 1.5mg/mL')).toBeTruthy();
  });

  test('searching by barcode finds the item', async () => {
    seed([
      createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12, barcode: '300001111222' }),
      createEmptyItem({ drugName: 'Meloxicam 1.5mg/mL', quantityOnHand: 3, barcode: '300003333444' }),
    ]);

    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: '300003333444' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Carprofen 100mg')).toBeNull();
    });
    expect(screen.getByText('Meloxicam 1.5mg/mL')).toBeTruthy();
  });

  test('the +1 control routes to /add in addQty mode so the quantity ADDS', async () => {
    seed([createEmptyItem({ drugName: 'Carprofen 100mg', quantityOnHand: 12 })]);

    render(<InventoryScreen />);
    await screen.findByText('Carprofen 100mg');

    fireEvent.click(screen.getByText('+1'));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/add',
        params: expect.objectContaining({ mode: 'addQty' }),
      }),
    );
  });

  test('survives corrupt storage without crashing the list', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
      key === INVENTORY_KEY ? '{not valid json' : null,
    );

    render(<InventoryScreen />);
    expect(await screen.findByText('No stock yet')).toBeTruthy();
  });
});

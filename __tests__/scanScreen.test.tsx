/**
 * Scan screen — type-in lookup and the Read barcode control must exist
 * even when the camera preview is a stub (jsdom has no getUserMedia).
 * Camera is preview-only; decode happens on the shutter. Unknown codes
 * search free public catalogs and offer Create with those details.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyItem, InventoryItem } from '../lib/domain/inventory';
import { resetKioskMemory } from '../lib/kiosk/session';
import { emptyHint, ProductHint } from '../lib/scan/productLookup';

const mockReplace = jest.fn();
const mockLookup = jest.fn();

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = effect();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [effect]);
    },
  };
});

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));

jest.mock('../components/WebBarcodeCamera', () => {
  const React = require('react');
  return {
    WebBarcodeCamera: React.forwardRef((props: { active?: boolean }, ref: React.Ref<{ capture: () => Promise<string | null>; decodeFile: () => Promise<string | null> }>) => {
      React.useImperativeHandle(ref, () => ({
        capture: async () => '10026696',
        decodeFile: async () => '10026696',
      }));
      return React.createElement('div', {
        'data-testid': 'web-camera',
        'data-active': props.active ? 'true' : 'false',
      });
    }),
  };
});

jest.mock('../lib/scan/productLookup', () => {
  const actual = jest.requireActual('../lib/scan/productLookup');
  return {
    ...actual,
    lookupProductOnline: (...args: unknown[]) => mockLookup(...args),
  };
});

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// eslint-disable-next-line import/first
import ScanScreen from '../app/scan';

const INVENTORY_KEY = 'megatory_live_inventory_v1';

function seed(items: InventoryItem[]) {
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) =>
    key === INVENTORY_KEY ? JSON.stringify(items) : null,
  );
}

function webHit(code: string): ProductHint {
  return {
    barcode: code,
    drugName: 'Heartgard Plus',
    genericName: 'ivermectin',
    manufacturer: 'Boehringer',
    concentration: '',
    form: 'Chewable',
    packUnits: '6',
    source: 'openproducts',
    sourceLabel: 'Open Products Facts',
  };
}

describe('ScanScreen (rendered)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKioskMemory();
    (AsyncStorage.getItem as jest.Mock).mockReset();
    mockLookup.mockImplementation(async (code: string) => emptyHint(code));
  });

  test('always shows a type-in box and a Read barcode button', async () => {
    seed([]);
    render(<ScanScreen />);
    expect(await screen.findByLabelText(/type barcode or manufacturer number/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /read barcode now/i })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('web-camera').getAttribute('data-active')).toBe('true');
    });
  });

  test('typed lookup finds a catalog item by manufacturer number and skips the web', async () => {
    seed([createEmptyItem({ drugName: 'Alfaxan 10mL', barcode: '10026696', quantityOnHand: 1, unit: 'bottle' })]);
    render(<ScanScreen />);
    const input = await screen.findByLabelText(/type barcode or manufacturer number/i);
    fireEvent.change(input, { target: { value: '00-10026696' } });
    fireEvent.click(screen.getByRole('button', { name: /look up typed barcode/i }));
    expect(await screen.findByText('Alfaxan 10mL')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add one alfaxan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /scan another barcode/i })).toBeTruthy();
    expect(mockLookup).not.toHaveBeenCalled();
    expect(screen.getByTestId('web-camera').getAttribute('data-active')).toBe('false');
  });

  test('Read barcode uses the shutter and shows the matched drug', async () => {
    seed([createEmptyItem({ drugName: 'Alfaxan 10mL', barcode: '10026696', quantityOnHand: 1, unit: 'bottle' })]);
    render(<ScanScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /read barcode now/i }));
    expect(await screen.findByText('Alfaxan 10mL')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /read barcode now/i })).toBeNull();
  });

  test('unknown barcode with no web match offers Create and is honest', async () => {
    seed([]);
    render(<ScanScreen />);
    const input = await screen.findByLabelText(/type barcode or manufacturer number/i);
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /look up typed barcode/i }));
    expect(await screen.findByRole('button', { name: /create new item from this barcode/i })).toBeTruthy();
    expect(await screen.findByText(/no web match/i)).toBeTruthy();
    expect(mockLookup).toHaveBeenCalledWith('999999');
  });

  test('unknown barcode with a web hit autofills Create params', async () => {
    mockLookup.mockImplementation(async (code: string) => webHit(code));
    seed([]);
    render(<ScanScreen />);
    const input = await screen.findByLabelText(/type barcode or manufacturer number/i);
    fireEvent.change(input, { target: { value: '0123456789012' } });
    fireEvent.click(screen.getByRole('button', { name: /look up typed barcode/i }));
    expect(await screen.findByText('Heartgard Plus')).toBeTruthy();
    expect(screen.getByText(/Boehringer/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /create new item from this barcode/i }));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/add',
      params: {
        barcode: '0123456789012',
        drugName: 'Heartgard Plus',
        genericName: 'ivermectin',
        manufacturer: 'Boehringer',
        concentration: '',
        form: 'Chewable',
        packUnits: '6',
        lookupSource: 'Open Products Facts',
      },
    });
  });
});

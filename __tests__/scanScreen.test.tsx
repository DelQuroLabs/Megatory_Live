/**
 * Scan screen — type-in lookup and the Read barcode control must exist
 * even when the camera preview is a stub (jsdom has no getUserMedia).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEmptyItem, InventoryItem } from '../lib/domain/inventory';
import { resetKioskMemory } from '../lib/kiosk/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));

jest.mock('../components/WebBarcodeCamera', () => {
  const React = require('react');
  return {
    WebBarcodeCamera: React.forwardRef((_props: unknown, ref: React.Ref<{ capture: () => Promise<string | null>; decodeFile: () => Promise<string | null> }>) => {
      React.useImperativeHandle(ref, () => ({
        capture: async () => '10026696',
        decodeFile: async () => '10026696',
      }));
      return React.createElement('div', { 'data-testid': 'web-camera' });
    }),
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

describe('ScanScreen (rendered)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKioskMemory();
    (AsyncStorage.getItem as jest.Mock).mockReset();
  });

  test('always shows a type-in box and a Read barcode button', async () => {
    seed([]);
    render(<ScanScreen />);
    expect(await screen.findByLabelText(/type barcode or manufacturer number/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /read barcode now/i })).toBeTruthy();
  });

  test('typed lookup finds a catalog item by manufacturer number', async () => {
    seed([createEmptyItem({ drugName: 'Alfaxan 10mL', barcode: '10026696', quantityOnHand: 1, unit: 'bottle' })]);
    render(<ScanScreen />);
    const input = await screen.findByLabelText(/type barcode or manufacturer number/i);
    fireEvent.change(input, { target: { value: '00-10026696' } });
    fireEvent.click(screen.getByRole('button', { name: /look up typed barcode/i }));
    expect(await screen.findByText('Alfaxan 10mL')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add one alfaxan/i })).toBeTruthy();
  });

  test('Read barcode uses the shutter and shows the matched drug', async () => {
    seed([createEmptyItem({ drugName: 'Alfaxan 10mL', barcode: '10026696', quantityOnHand: 1, unit: 'bottle' })]);
    render(<ScanScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /read barcode now/i }));
    expect(await screen.findByText('Alfaxan 10mL')).toBeTruthy();
  });

  test('unknown barcode offers Create instead of failing silently', async () => {
    seed([]);
    render(<ScanScreen />);
    const input = await screen.findByLabelText(/type barcode or manufacturer number/i);
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /look up typed barcode/i }));
    expect(await screen.findByText('999999')).toBeTruthy();
    expect(screen.getByRole('button', { name: /create new item from this barcode/i })).toBeTruthy();
  });
});

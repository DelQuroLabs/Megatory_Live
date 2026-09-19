/**
 * Create screen applies barcode + web-lookup hint params into the form.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// eslint-disable-next-line import/first
import AddScreen from '../app/add';

describe('AddScreen (rendered)', () => {
  beforeEach(() => {
    Object.keys(mockParams).forEach(k => { delete mockParams[k]; });
  });

  test('fills name, maker, form, and pack from scan lookup params', async () => {
    Object.assign(mockParams, {
      barcode: '0123456789012',
      drugName: 'Heartgard Plus',
      genericName: 'ivermectin',
      manufacturer: 'Boehringer',
      concentration: '68 mcg',
      form: 'Chewable',
      packUnits: '6',
      lookupSource: 'Open Products Facts',
    });
    render(<AddScreen />);
    expect(await screen.findByDisplayValue('Heartgard Plus')).toBeTruthy();
    expect(screen.getByDisplayValue('ivermectin')).toBeTruthy();
    expect(screen.getByDisplayValue('Boehringer')).toBeTruthy();
    expect(screen.getByDisplayValue('68 mcg')).toBeTruthy();
    expect(screen.getByDisplayValue('0123456789012')).toBeTruthy();
    expect(screen.getByDisplayValue('6')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/filled from open products facts/i)).toBeTruthy();
    });
    expect(screen.getByLabelText('Form Chewable (selected)')).toBeTruthy();
  });
});

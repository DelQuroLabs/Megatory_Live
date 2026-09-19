/**
 * Dayforce-style clock: register once, then who-is-counting.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { resetKioskMemory } from '../lib/kiosk/session';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../lib/kiosk/notebook', () => ({
  openHospitalNotebook: jest.fn(async () => ({ blobId: 'blob-test-1', items: [] })),
  openNewNotebook: jest.fn(async () => 'blob-test-1'),
  joinNotebook: jest.fn(async () => []),
  pullNotebook: jest.fn(async () => []),
  pushNotebook: jest.fn(async () => undefined),
}));

// eslint-disable-next-line import/first
import { KioskGate } from '../components/KioskGate';

describe('KioskGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKioskMemory();
  });

  test('blocks the app until the clock is registered and someone signs in', async () => {
    render(
      <KioskGate>
        <div>APP INSIDE</div>
      </KioskGate>,
    );

    expect(await screen.findByLabelText('Register this clock')).toBeTruthy();
    expect(screen.queryByText('APP INSIDE')).toBeNull();

    fireEvent.change(screen.getByLabelText('Hospital code'), { target: { value: 'OAKVW' } });
    fireEvent.change(screen.getByLabelText('Clock name'), { target: { value: 'Pharmacy iPad' } });
    fireEvent.click(screen.getByLabelText('PIN digit 1'));
    fireEvent.click(screen.getByLabelText('PIN digit 2'));
    fireEvent.click(screen.getByLabelText('PIN digit 3'));
    fireEvent.click(screen.getByLabelText('PIN digit 4'));
    fireEvent.click(screen.getByRole('button', { name: 'Register clock' }));

    expect(await screen.findByLabelText('Sign in to count')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start counting' }));

    await waitFor(() => {
      expect(screen.getByText('APP INSIDE')).toBeTruthy();
    });
  });
});

/**
 * Dayforce-style clock: register once, then who-is-counting.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { resetKioskMemory, loadRegistration } from '../lib/kiosk/session';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../lib/kiosk/notebook', () => ({
  createHospitalNotebook: jest.fn(async () => ({ blobId: 'blob-test-1', syncKey: 'secret-test-key', items: [] })),
  joinHospitalNotebook: jest.fn(async () => []),
  pullNotebook: jest.fn(async () => []),
  pushNotebook: jest.fn(async () => undefined),
}));

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import { KioskGate } from '../components/KioskGate';
// eslint-disable-next-line import/first
import { createHospitalNotebook, joinHospitalNotebook } from '../lib/kiosk/notebook';

function typeRegistration() {
  fireEvent.change(screen.getByLabelText('Hospital code'), { target: { value: 'OAKVW' } });
  fireEvent.change(screen.getByLabelText('Clock name'), { target: { value: 'Pharmacy iPad' } });
  for (const d of ['1', '2', '3', '4']) fireEvent.click(screen.getByLabelText('PIN digit ' + d));
}

describe('KioskGate', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear(); // the mock keeps the previous test's clock otherwise
    resetKioskMemory();
    window.history.replaceState({}, '', '/');
  });

  test('blocks the app until the clock is registered and someone signs in', async () => {
    render(
      <KioskGate>
        <div>APP INSIDE</div>
      </KioskGate>,
    );

    expect(await screen.findByLabelText('Register this clock')).toBeTruthy();
    expect(screen.queryByText('APP INSIDE')).toBeNull();

    typeRegistration();
    fireEvent.click(screen.getByRole('button', { name: 'Register clock' }));

    expect(await screen.findByLabelText('Sign in to count')).toBeTruthy();
    expect(createHospitalNotebook).toHaveBeenCalledWith({ hospitalCode: 'OAKVW', sitePin: '1234' });
    expect((await loadRegistration())?.syncKey).toBe('secret-test-key');
    expect(window.location.search).toContain('k=secret-test-key');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start counting' }));

    await waitFor(() => {
      expect(screen.getByText('APP INSIDE')).toBeTruthy();
    });
  });

  test('an invite link with the notebook secret joins that notebook instead of creating one', async () => {
    window.history.replaceState({}, '', '/?ns=OAKVW&nb=nb-from-qr-123456&k=secret-from-qr-0123456789abcdef');
    render(
      <KioskGate>
        <div>APP INSIDE</div>
      </KioskGate>,
    );
    expect(await screen.findByText('Join this hospital clock')).toBeTruthy();
    typeRegistration();
    fireEvent.click(screen.getByRole('button', { name: 'Join clock' }));
    expect(await screen.findByLabelText('Sign in to count')).toBeTruthy();
    expect(joinHospitalNotebook).toHaveBeenCalledWith({ blobId: 'nb-from-qr-123456', syncKey: 'secret-from-qr-0123456789abcdef', hospitalCode: 'OAKVW', sitePin: '1234' });
    expect(createHospitalNotebook).not.toHaveBeenCalled();
    expect((await loadRegistration())?.syncKey).toBe('secret-from-qr-0123456789abcdef');
  });
});

/**
 * Files → PairDrop must be a real external link that opens a new window.
 * Same-tab Linking.openURL is the defect this component exists to avoid.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PairDropLink } from '../components/PairDropLink';
import { PAIRDROP_URL } from '../lib/share/pairdrop';

describe('PairDropLink', () => {
  test('web renders an <a target="_blank" rel="noopener"> to pairdrop.net', () => {
    const { container } = render(<PairDropLink />);
    const anchor = container.querySelector('a');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('href')).toBe(PAIRDROP_URL);
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel') || '').toMatch(/noopener/);
    expect(anchor?.getAttribute('rel') || '').toMatch(/noreferrer/);
    expect(screen.getByLabelText(/open pairdrop\.net in a new window/i)).toBeTruthy();
  });
});

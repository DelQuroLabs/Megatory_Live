import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabDock } from '../components/TabDock';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function fakeNav(index = 0) {
  const routes = [
    { key: 'stock', name: 'index' },
    { key: 'scan', name: 'scan' },
    { key: 'add', name: 'add' },
    { key: 'files', name: 'import-export' },
    { key: 'ghost', name: '_sitemap' },
  ];
  const navigate = jest.fn();
  return {
    navigate,
    props: {
      state: { index, routes },
      descriptors: {
        stock: { options: { title: 'Stock' } },
        scan: { options: { title: 'Scan' } },
        add: { options: { title: 'Add' } },
        files: { options: { title: 'Files' } },
        ghost: { options: { href: null, title: 'Sitemap' } },
      },
      navigation: {
        emit: () => ({ defaultPrevented: false }),
        navigate,
      },
    },
  };
}

describe('TabDock', () => {
  test('shows the four rooms and hides sitemap leftovers', () => {
    render(<TabDock {...fakeNav().props} />);
    expect(screen.getByLabelText('Stock tab (selected)')).toBeTruthy();
    expect(screen.getByLabelText('Scan tab')).toBeTruthy();
    expect(screen.getByLabelText('Add tab')).toBeTruthy();
    expect(screen.getByLabelText('Files tab')).toBeTruthy();
    expect(screen.queryByText(/sitemap/i)).toBeNull();
  });

  test('does not use emoji as the tab label', () => {
    const { container } = render(<TabDock {...fakeNav().props} />);
    expect(container.textContent).toMatch(/Stock/);
    expect(container.textContent).not.toMatch(/📋|📷|📁/);
  });

  test('tapping Files navigates to import-export', () => {
    const nav = fakeNav(0);
    render(<TabDock {...nav.props} />);
    fireEvent.click(screen.getByLabelText('Files tab'));
    expect(nav.navigate).toHaveBeenCalledWith('import-export', undefined);
  });
});

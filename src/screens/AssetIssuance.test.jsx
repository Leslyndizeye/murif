import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssetIssuance from './AssetIssuance';
import { assetAPI, assetVoucherAPI } from '../services/api';

jest.mock('../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../components/layout/TopNavbar', () => () => null);
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'VOUCHER', username: 'logistics.operator' } }) }));
jest.mock('../services/api', () => ({ assetAPI: { list: jest.fn() }, assetVoucherAPI: { list: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  assetAPI.list.mockResolvedValue([]);
  assetVoucherAPI.list.mockResolvedValue([]);
});

test('uses Logistics for record labels and the empty state', async () => {
  render(<AssetIssuance />);
  expect(await screen.findByText('No logistics records found.')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Logistics' })).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Logistics ID' })).toBeTruthy();
  expect(screen.queryByText(/voucher/i)).toBeNull();
});

test('uses Logistics in the record details without changing existing record IDs', async () => {
  assetVoucherAPI.list.mockResolvedValue([{ id: 1, voucher_number: 'VCH-1', status: 'Returned', date_issued: '2026-10-01T08:00:00Z' }]);
  render(<AssetIssuance />);
  fireEvent.click(await screen.findByText('VCH-1'));
  expect(screen.getByRole('heading', { name: 'Logistics record VCH-1' })).toBeTruthy();
});

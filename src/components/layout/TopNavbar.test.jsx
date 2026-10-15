import React from 'react';
import { render, screen } from '@testing-library/react';
import TopNavbar from './TopNavbar';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'VOUCHER', full_name: 'Logistics Operator' } }) }));

test('shows Logistics for an existing voucher account in the profile bar', () => {
  render(<TopNavbar title="Assets" />);
  expect(screen.getByText('Logistics')).toBeTruthy();
  expect(screen.queryByText('VOUCHER')).toBeNull();
});

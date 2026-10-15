import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VoucherPage from './Voucherpage';
import { documentAPI, voucherAPI } from '../services/api';

jest.mock('react-router-dom', () => ({ useLocation: () => ({ search: '?ticket=TKT-20261015-0013' }) }), { virtual: true });
jest.mock('../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../components/layout/TopNavbar', () => () => null);
jest.mock('../components/ui/calendar-scheduler', () => ({ CalendarScheduler: () => null }));
jest.mock('../components/ui/dropdown-select', () => ({ value, onChange, options }) => (
  <select aria-label="Ticket status" value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
));
jest.mock('../services/api', () => ({
  documentAPI: { list: jest.fn() },
  voucherAPI: { list: jest.fn(), update: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ id: 1, role: 'IT' }));
  documentAPI.list.mockResolvedValue([]);
  voucherAPI.list.mockResolvedValue([{
    id: 13, ticket_number: 'TKT-20261015-0013', title: 'Printer problem', status: 'open',
  }]);
});

afterEach(() => localStorage.clear());

test('shows a rejected status update as text and leaves the ticket editable', async () => {
  voucherAPI.update.mockRejectedValue({ response: { status: 422, data: { detail: [{
    type: 'literal_error', loc: ['body', 'status'], msg: 'Input should be a valid status',
    input: { target: { value: 'resolved' } }, ctx: {},
  }] } } });
  render(<VoucherPage />);
  fireEvent.change(await screen.findByRole('combobox', { name: 'Ticket status' }), { target: { value: 'resolved' } });

  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'status: Input should be a valid status');
  expect(voucherAPI.update).toHaveBeenCalledWith(13, { status: 'resolved' });
  expect(screen.getByRole('combobox', { name: 'Ticket status' }).value).toBe('open');
});

test('reloads the saved status after a successful update', async () => {
  voucherAPI.update.mockResolvedValue({ id: 13, status: 'resolved' });
  render(<VoucherPage />);
  const status = await screen.findByRole('combobox', { name: 'Ticket status' });
  voucherAPI.list.mockResolvedValue([{
    id: 13, ticket_number: 'TKT-20261015-0013', title: 'Printer problem', status: 'resolved',
  }]);
  fireEvent.change(status, { target: { value: 'resolved' } });

  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Ticket status' }).value).toBe('resolved'));
  expect(voucherAPI.update).toHaveBeenCalledWith(13, { status: 'resolved' });
  expect(screen.getByRole('status').textContent).toBe('Ticket status updated.');
});

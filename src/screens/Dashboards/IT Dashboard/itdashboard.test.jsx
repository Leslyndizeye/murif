import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ITDashboard from './itdashboard';
import { assetAPI, documentAPI, reportAPI, usersAPI, voucherAPI } from '../../../services/api';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../../../components/layout/TopNavbar', () => () => null);
jest.mock('../../../services/api', () => ({
  assetAPI: { list: jest.fn() }, documentAPI: { list: jest.fn() }, usersAPI: { listUsers: jest.fn() }, voucherAPI: { list: jest.fn() },
  reportAPI: { getOverview: jest.fn(), checkSla: jest.fn(), getNotifications: jest.fn() },
}));

const regularUser = { id: 10, full_name: 'Sam Newperson', email: 'sam@icttoolsasm.com', role: 'USER', is_active: true };
const itUser = { id: 20, full_name: 'Toni Support', email: 'toni@icttoolsasm.com', role: 'IT', is_active: true };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ id: 1, role: 'IT', email: 'operator@icttoolsasm.com' }));
  localStorage.setItem('access_token', 'test-token');
  usersAPI.listUsers.mockResolvedValue([regularUser, itUser]);
  voucherAPI.list.mockResolvedValue([]);
  documentAPI.list.mockResolvedValue([]);
  assetAPI.list.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
  reportAPI.getOverview.mockResolvedValue({ workload: [{ user_id: 20, email: itUser.email, active_tickets: 0 }] });
  reportAPI.checkSla.mockResolvedValue({});
  reportAPI.getNotifications.mockResolvedValue([]);
});
afterEach(() => localStorage.clear());

test('shows saved users with no tickets and replaces invented account statistics', async () => {
  render(<ITDashboard />);
  const directory = screen.getByRole('table', { name: 'Employee directory' });
  expect(await within(directory).findByText(regularUser.full_name)).toBeTruthy();
  expect(within(directory).getByText(itUser.full_name)).toBeTruthy();
  expect(within(directory).getByText('USER')).toBeTruthy();
  expect(usersAPI.listUsers).toHaveBeenCalledTimes(1);
  const summary = screen.getByRole('region', { name: 'Account overview' });
  expect(within(summary).getAllByText('2')).toHaveLength(2);
  expect(within(summary).getByText('1')).toBeTruthy();
  expect(screen.queryByText('Working format')).toBeNull();
  expect(screen.queryByText('Remote')).toBeNull();
  expect(await screen.findByRole('button', { name: /Inventory 3 Total assets/i })).toBeTruthy();
});

test.each(['asm-users-updated', 'focus'])('refreshes saved people on %s', async (eventName) => {
  usersAPI.listUsers.mockResolvedValue([itUser]);
  render(<ITDashboard />);
  const directory = screen.getByRole('table', { name: 'Employee directory' });
  await within(directory).findByText(itUser.full_name);
  expect(within(directory).queryByText(regularUser.full_name)).toBeNull();
  usersAPI.listUsers.mockResolvedValue([regularUser, itUser]);
  fireEvent(window, new Event(eventName));
  expect(await within(directory).findByText(regularUser.full_name)).toBeTruthy();
  expect(usersAPI.listUsers).toHaveBeenCalledTimes(2);
});

test('refresh button reloads changed account status', async () => {
  render(<ITDashboard />);
  const directory = screen.getByRole('table', { name: 'Employee directory' });
  await within(directory).findByText(regularUser.full_name);
  usersAPI.listUsers.mockResolvedValue([{ ...regularUser, is_active: false }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh people' }));
  expect(await within(directory).findByText('Inactive')).toBeTruthy();
});

test('directory is independent of ticket and notification failures', async () => {
  voucherAPI.list.mockRejectedValue(new Error('Network Error'));
  render(<ITDashboard />);
  expect(await screen.findByText(regularUser.full_name)).toBeTruthy();
  expect(await screen.findByText('Failed to load dashboard data')).toBeTruthy();
});

test('renders a directory error safely instead of displaying sample people', async () => {
  usersAPI.listUsers.mockRejectedValue({ response: { data: { detail: [{ loc: ['query', 'limit'], msg: 'Invalid limit' }] } } });
  render(<ITDashboard />);
  expect((await screen.findByRole('alert')).textContent).toBe('limit: Invalid limit');
  expect(within(screen.getByRole('table', { name: 'Employee directory' })).getAllByRole('row')).toHaveLength(1);
  expect(screen.getByText('Account counts are unavailable.')).toBeTruthy();
});

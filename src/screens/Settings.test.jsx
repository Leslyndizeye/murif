import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Settings from './Settings';
import { departmentAPI, stationAPI, usersAPI } from '../services/api';

const mockRedirect = jest.fn();
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/settings/it' }), Navigate: (props) => { mockRedirect(props); return null; } }), { virtual: true });
jest.mock('../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../components/layout/TopNavbar', () => () => null);
jest.mock('../components/ui/checkbox', () => ({ Checkbox: () => null }));
jest.mock('../components/ui/button', () => ({ Button: () => null }));
jest.mock('../services/api', () => ({
  departmentAPI: { list: jest.fn() }, stationAPI: { list: jest.fn() }, usersAPI: { createUser: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('user', JSON.stringify({ role: 'IT', email: 'operator@icttoolsasm.com', username: 'operator' }));
  departmentAPI.list.mockResolvedValue([]);
  stationAPI.list.mockResolvedValue([]);
});
afterEach(() => localStorage.clear());

const fillQuickGrant = () => {
  const form = within(screen.getByRole('region', { name: 'User Access Grant' }));
  fireEvent.change(form.getByLabelText('Email'), { target: { value: 'NEW@ICTTOOLSASM.COM' } });
  fireEvent.change(form.getByLabelText('Username'), { target: { value: ' New.Person ' } });
};

test('saves the selected role, prevents duplicate submission, and signals a successful grant', async () => {
  let finishRequest;
  usersAPI.createUser.mockReturnValue(new Promise((resolve) => { finishRequest = resolve; }));
  const onUsersUpdated = jest.fn();
  window.addEventListener('asm-users-updated', onUsersUpdated);
  try {
    render(<Settings />);
    expect(mockRedirect).not.toHaveBeenCalled();
    fillQuickGrant();
    const form = within(screen.getByRole('region', { name: 'User Access Grant' }));
    fireEvent.change(form.getByLabelText('Role'), { target: { value: 'IT' } });
    fireEvent.click(form.getByRole('button', { name: 'Grant Access' }));
    expect(form.getByRole('button', { name: 'Granting access...' }).disabled).toBe(true);
    expect(usersAPI.createUser).toHaveBeenCalledTimes(1);
    expect(onUsersUpdated).not.toHaveBeenCalled();
    expect(usersAPI.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@icttoolsasm.com', username: 'new.person', role: 'IT' }));
    finishRequest({ message: 'Created' });
    expect((await form.findByRole('status')).textContent).toContain('User access granted');
    expect(onUsersUpdated).toHaveBeenCalledTimes(1);
    expect(form.getByLabelText('Email').value).toBe('');
  } finally {
    window.removeEventListener('asm-users-updated', onUsersUpdated);
  }
});

test.each([
  [{ response: { status: 422, data: { detail: [{ loc: ['body', 'email'], msg: 'Use organization email' }] } } }, 'email: Use organization email'],
  [{ response: { status: 502, data: { detail: 'Email service is not configured.' } } }, 'Email service is not configured.'],
  [new Error('Network Error'), 'Failed to grant user access.'],
])('shows a failed grant beside its button and keeps the entered person: %s', async (error, message) => {
  usersAPI.createUser.mockRejectedValue(error);
  render(<Settings />);
  fillQuickGrant();
  const form = within(screen.getByRole('region', { name: 'User Access Grant' }));
  fireEvent.click(form.getByRole('button', { name: 'Grant Access' }));
  expect((await form.findByRole('alert')).textContent).toBe(message);
  expect(form.queryByRole('status')).toBeNull();
  expect(form.getByLabelText('Email').value.toLowerCase()).toBe('new@icttoolsasm.com');
  expect(form.getByRole('button', { name: 'Grant Access' }).disabled).toBe(false);
});

test('keeps a new member email separate from the logged-in operator email', async () => {
  usersAPI.createUser.mockResolvedValue({ message: 'Created' });
  render(<Settings />);
  const form = within(screen.getByRole('region', { name: 'Member Access' }));
  expect(form.getByLabelText('Email').value).toBe('');
  fireEvent.change(form.getByLabelText('First Name'), { target: { value: 'Ada' } });
  fireEvent.change(form.getByLabelText('Last Name'), { target: { value: 'Lovelace' } });
  fireEvent.change(form.getByLabelText('Email'), { target: { value: 'ADA@ICTTOOLSASM.COM' } });
  fireEvent.change(form.getByLabelText('Username'), { target: { value: ' Ada ' } });
  fireEvent.click(form.getByRole('button', { name: 'Grant Member Access' }));
  await waitFor(() => expect(usersAPI.createUser).toHaveBeenCalledWith(expect.objectContaining({
    email: 'ada@icttoolsasm.com', username: 'ada', full_name: 'Ada Lovelace', role: 'USER',
  })));
  expect((await form.findByRole('status')).textContent).toContain('User access granted');
  expect(screen.getByDisplayValue('operator@icttoolsasm.com')).toBeTruthy();
});

test('does not offer account creation to a read-only manager', async () => {
  localStorage.setItem('user', JSON.stringify({ role: 'MANAGER' }));
  render(<Settings />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByRole('button', { name: 'Grant Access' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Grant Member Access' })).toBeNull();
});

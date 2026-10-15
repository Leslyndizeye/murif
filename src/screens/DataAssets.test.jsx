import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DataAssets from './DataAssets';
import { assetAPI, usersAPI } from '../services/api';

jest.mock('../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../components/layout/TopNavbar', () => () => null);
let mockRole = 'IT';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mockRole } }) }));
jest.mock('../components/ui/button-utility', () => ({ ButtonUtility: ({ tooltip, onClick }) => <button aria-label={tooltip} onClick={onClick}>{tooltip}</button> }));
jest.mock('../services/api', () => ({
  usersAPI: { listUsers: jest.fn(), createUser: jest.fn(), deleteUser: jest.fn() },
  assetAPI: { list: jest.fn(), update: jest.fn(), create: jest.fn(), remove: jest.fn() },
}));

const device = { id: 7, name: 'Dell', category: 'Desktop', serial_number: 'DELL-7', status: 'Available' };
const secondDevice = { id: 8, name: 'HP', category: 'Laptop', serial_number: 'HP-8', status: 'Available' };

beforeEach(() => {
  jest.resetAllMocks();
  mockRole = 'IT';
  assetAPI.list.mockResolvedValue([device, secondDevice]);
  usersAPI.listUsers.mockResolvedValue([]);
});

const employee = { id: 42, full_name: 'Vanessa', username: 'vanessa', email: 'vanessa@icttoolsasm.com', department: 'Finance', role: 'USER', is_active: true };

const openNewUser = async () => {
  const view = render(<DataAssets />);
  await waitFor(() => expect(usersAPI.listUsers).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Add New' }));
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: ' Vanessa ' } });
  fireEvent.change(screen.getByLabelText('Username (optional)'), { target: { value: ' vanessa ' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'VANESSA@icttoolsasm.com' } });
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: ' Finance ' } });
  return view;
};

test('creates the user on the backend and loads the persisted record after remount', async () => {
  let storedUsers = [];
  usersAPI.listUsers.mockImplementation(async () => storedUsers);
  usersAPI.createUser.mockImplementation(async () => {
    storedUsers = [employee];
    return { message: 'Account created. Send the login details to the user manually.', email: employee.email, username: employee.username, temporary_password: 'Test-temporary-234' };
  });
  const view = await openNewUser();
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  expect(await screen.findByText('Vanessa')).toBeTruthy();
  expect(usersAPI.createUser).toHaveBeenCalledWith({ full_name: 'Vanessa', username: 'vanessa', email: 'vanessa@icttoolsasm.com', department: 'Finance', role: 'USER' });
  const details = within(await screen.findByRole('dialog', { name: 'Account created — send login details' }));
  expect(details.getByLabelText('Temporary password').value).toBe('Test-temporary-234');
  fireEvent.click(details.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Send the login details');
  view.unmount();
  render(<DataAssets />);
  expect(await screen.findByText('Vanessa')).toBeTruthy();
  expect(screen.queryByLabelText('Temporary password')).toBeNull();
});

test.each([
  ['Use organization email'],
  ['Email already registered'],
  ['Email delivery failed'],
  [[{ loc: ['body', 'email'], msg: 'Invalid email' }]],
])('keeps rejected user saves visible with a readable error: %s', async (detail) => {
  usersAPI.createUser.mockRejectedValue({ response: { data: { detail } } });
  const view = await openNewUser();
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  const editor = within(screen.getByRole('dialog', { name: 'Add New User' }));
  expect((await editor.findByRole('alert')).textContent).toBe(typeof detail === 'string' ? detail : 'email: Invalid email');
  expect(editor.getByLabelText('Full Name').value).toBe(' Vanessa ');
  expect(screen.queryByText('Vanessa')).toBeNull();
  view.unmount();
  render(<DataAssets />);
  expect(await screen.findByText('No users found')).toBeTruthy();
});

test('waits for creation before adding any row and blocks duplicate submissions', async () => {
  let finish;
  usersAPI.createUser.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await openNewUser();
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Close item form' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));
  expect(usersAPI.createUser).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Vanessa')).toBeNull();
  usersAPI.listUsers.mockResolvedValue([employee]);
  finish({});
  expect(await screen.findByText('Vanessa')).toBeTruthy();
});

test('does not offer to create again when creation succeeded but refreshing the list failed', async () => {
  await openNewUser();
  usersAPI.createUser.mockResolvedValue({});
  usersAPI.listUsers.mockRejectedValue(new Error('Network unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  expect((await screen.findByRole('alert')).textContent).toContain('User was created, but the list could not be refreshed');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(usersAPI.createUser).toHaveBeenCalledTimes(1);
});

test('requires a nonblank name and supports optional username and department', async () => {
  await openNewUser();
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  expect(screen.getByRole('alert').textContent).toContain('Full name and organization email are required');
  expect(usersAPI.createUser).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Vanessa' } });
  fireEvent.change(screen.getByLabelText('Username (optional)'), { target: { value: ' ' } });
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '' } });
  usersAPI.createUser.mockResolvedValue({});
  fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(usersAPI.createUser).toHaveBeenCalledWith(expect.objectContaining({ username: null, department: null }));
});

test('user removal persists through the backend after remount', async () => {
  let storedUsers = [employee];
  usersAPI.listUsers.mockImplementation(async () => storedUsers);
  usersAPI.deleteUser.mockImplementation(async () => { storedUsers = []; });
  const view = render(<DataAssets />);
  await screen.findByText('Vanessa');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Vanessa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove 1 Items' }));
  await waitFor(() => expect(screen.queryByText('Vanessa')).toBeNull());
  expect(usersAPI.deleteUser).toHaveBeenCalledWith(42);
  view.unmount();
  render(<DataAssets />);
  expect(await screen.findByText('No users found')).toBeTruthy();
});

test('partial deletion keeps rejected users and displays the backend reason', async () => {
  const secondUser = { ...employee, id: 43, full_name: 'Another User', email: 'another@icttoolsasm.com' };
  usersAPI.listUsers.mockResolvedValue([employee, secondUser]);
  usersAPI.deleteUser.mockImplementation(async (id) => {
    if (id === 42) {
      const error = new Error('User has ticket history');
      error.response = { data: { detail: 'User has ticket history. Deactivate instead.' } };
      throw error;
    }
  });
  render(<DataAssets />);
  await screen.findByText('Vanessa');
  fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove 2 Items' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Deactivate instead.');
  expect(screen.getByText('Vanessa')).toBeTruthy();
  expect(screen.queryByText('Another User')).toBeNull();
  expect(screen.getByRole('button', { name: 'Remove 1 Items' })).toBeTruthy();
});

test('read-only account roles cannot add or remove users', async () => {
  mockRole = 'MANAGER';
  render(<DataAssets />);
  await waitFor(() => expect(usersAPI.listUsers).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Add New' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove', exact: true })).toBeNull();
});

const renderDevices = async () => {
  const view = render(<DataAssets />);
  fireEvent.click(screen.getByRole('button', { name: 'IT Devices' }));
  await screen.findByText('Dell');
  return view;
};
const openEditor = async () => {
  await renderDevices();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Dell' }));
  return screen.getByRole('dialog', { name: 'Edit IT Device' });
};

test('saves device edits through the backend and displays the returned record after reload', async () => {
  const updated = { ...device, name: 'Updated Dell', category: 'Workstation', serial_number: 'NEW-7', status: 'Disposed' };
  assetAPI.update.mockResolvedValue(updated);
  const view = await renderDevices();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Dell' }));
  const editor = within(screen.getByRole('dialog', { name: 'Edit IT Device' }));
  fireEvent.change(editor.getByLabelText('Asset Name'), { target: { value: ' Updated Dell ' } });
  fireEvent.change(editor.getByLabelText('Category'), { target: { value: 'Workstation' } });
  fireEvent.change(editor.getByLabelText('Serial Number'), { target: { value: 'NEW-7' } });
  fireEvent.change(editor.getByLabelText('Status'), { target: { value: 'Disposed' } });
  fireEvent.click(editor.getByRole('button', { name: 'Save Changes' }));
  expect(await screen.findByText('Updated Dell')).toBeTruthy();
  expect(assetAPI.update).toHaveBeenCalledWith(7, { name: 'Updated Dell', category: 'Workstation', serial_number: 'NEW-7', status: 'Disposed' });
  expect(screen.queryByRole('dialog')).toBeNull();

  view.unmount();
  assetAPI.list.mockResolvedValue([updated]);
  render(<DataAssets />);
  fireEvent.click(screen.getByRole('button', { name: 'IT Devices' }));
  expect(await screen.findByText('Updated Dell')).toBeTruthy();
});

test('keeps the editor and entered values when the server rejects an update', async () => {
  assetAPI.update.mockRejectedValue({ response: { status: 422, data: { detail: [{ loc: ['body', 'serial_number'], msg: 'Invalid serial number' }] } } });
  const editor = within(await openEditor());
  fireEvent.change(editor.getByLabelText('Serial Number'), { target: { value: 'NEW-SERIAL' } });
  fireEvent.click(editor.getByRole('button', { name: 'Save Changes' }));
  expect((await editor.findByRole('alert')).textContent).toBe('serial_number: Invalid serial number');
  expect(editor.getByLabelText('Serial Number').value).toBe('NEW-SERIAL');
  expect(screen.getByText('DELL-7')).toBeTruthy();
});

test('blocks repeat submission while saving', async () => {
  let finish;
  assetAPI.update.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const editor = within(await openEditor());
  fireEvent.click(editor.getByRole('button', { name: 'Save Changes' }));
  expect(editor.getByRole('button', { name: 'Saving...' }).disabled).toBe(true);
  expect(editor.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
  expect(assetAPI.update).toHaveBeenCalledTimes(1);
  finish(device);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test.each([
  ['   ', 'Asset name, category, and serial number are required.'],
  ['HP-8', 'An asset with this serial number already exists.'],
])('rejects an invalid serial number before updating: %s', async (serial, message) => {
  const editor = within(await openEditor());
  fireEvent.change(editor.getByLabelText('Serial Number'), { target: { value: serial } });
  fireEvent.click(editor.getByRole('button', { name: 'Save Changes' }));
  expect(editor.getByRole('alert').textContent).toBe(message);
  expect(assetAPI.update).not.toHaveBeenCalled();
});

test('cancels edits without saving them', async () => {
  const editor = within(await openEditor());
  fireEvent.change(editor.getByLabelText('Asset Name'), { target: { value: 'Unsaved name' } });
  fireEvent.click(editor.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Dell')).toBeTruthy();
  expect(assetAPI.update).not.toHaveBeenCalled();
});

test('the view button opens device details', async () => {
  await renderDevices();
  fireEvent.click(screen.getByRole('button', { name: 'View Dell' }));
  const details = within(screen.getByRole('dialog', { name: 'IT Device Details' }));
  expect(details.getByText('DELL-7')).toBeTruthy();
  expect(details.getByText('Desktop')).toBeTruthy();
  expect(details.queryByRole('button', { name: 'Save Changes' })).toBeNull();
  fireEvent.click(details.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('new devices use the create endpoint and start with the backend default status', async () => {
  assetAPI.create.mockResolvedValue({ ...device, id: 9, name: 'New Laptop', category: 'Laptop', serial_number: 'NEW-9' });
  await renderDevices();
  fireEvent.click(screen.getByRole('button', { name: 'Add New' }));
  const editor = within(screen.getByRole('dialog', { name: 'Add New Asset' }));
  fireEvent.change(editor.getByLabelText('Asset Name'), { target: { value: 'New Laptop' } });
  fireEvent.change(editor.getByLabelText('Category'), { target: { value: 'Laptop' } });
  fireEvent.change(editor.getByLabelText('Serial Number'), { target: { value: 'NEW-9' } });
  expect(editor.getByLabelText('Status').disabled).toBe(true);
  expect(editor.queryByRole('option', { name: 'Under Repair' })).toBeNull();
  fireEvent.click(editor.getByRole('button', { name: 'Add Item' }));
  expect(await screen.findByText('New Laptop')).toBeTruthy();
  expect(assetAPI.create).toHaveBeenCalledWith({ name: 'New Laptop', category: 'Laptop', serial_number: 'NEW-9' });
});

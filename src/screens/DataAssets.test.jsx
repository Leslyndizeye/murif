import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DataAssets from './DataAssets';
import { assetAPI, usersAPI } from '../services/api';

jest.mock('../components/layout/UnifiedSidebar', () => () => null);
jest.mock('../components/layout/TopNavbar', () => () => null);
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'IT' } }) }));
jest.mock('../components/ui/button-utility', () => ({ ButtonUtility: ({ tooltip, onClick }) => <button aria-label={tooltip} onClick={onClick}>{tooltip}</button> }));
jest.mock('../services/api', () => ({
  usersAPI: { listUsers: jest.fn() },
  assetAPI: { list: jest.fn(), update: jest.fn(), create: jest.fn() },
}));

const device = { id: 7, name: 'Dell', category: 'Desktop', serial_number: 'DELL-7', status: 'Available' };
const secondDevice = { id: 8, name: 'HP', category: 'Laptop', serial_number: 'HP-8', status: 'Available' };

beforeEach(() => {
  jest.clearAllMocks();
  assetAPI.list.mockResolvedValue([device, secondDevice]);
  usersAPI.listUsers.mockResolvedValue([]);
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

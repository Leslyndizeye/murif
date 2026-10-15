import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChangePassword from './ChangePassword';

const mockChangePassword = jest.fn();
const mockNavigate = jest.fn();
const mockLogout = jest.fn();
jest.mock('react-router-dom', () => ({ Navigate: () => null, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'USER', email: 'new@icttoolsasm.com', must_change_password: true }, changePassword: mockChangePassword, logout: mockLogout }) }));

beforeEach(() => jest.resetAllMocks());
const fill = (confirmation = 'My-new-password-234') => {
  fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'Temp-password-234' } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'My-new-password-234' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirmation } });
};

test('waits for the backend to replace the password before opening the dashboard', async () => {
  let finish;
  mockChangePassword.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<ChangePassword />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(screen.getByRole('button', { name: 'Saving...' }).disabled).toBe(true);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockChangePassword).toHaveBeenCalledWith('Temp-password-234', 'My-new-password-234');
  finish({ user: { role: 'USER', must_change_password: false } });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/user-dashboard', { replace: true }));
});

test('shows a backend failure and keeps the user on the password form', async () => {
  mockChangePassword.mockRejectedValue({ response: { data: { detail: 'Current password is incorrect' } } });
  render(<ChangePassword />);
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Current password is incorrect');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('rejects mismatched confirmation without sending a request', () => {
  render(<ChangePassword />);
  fill('Different-password');
  fireEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(screen.getByRole('alert').textContent).toBe('New passwords do not match.');
  expect(mockChangePassword).not.toHaveBeenCalled();
});

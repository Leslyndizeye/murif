import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from './ProtectedRoute';
import GuestRoute from './GuestRoute';

let mockPath = '/user-dashboard';
let mockUser = { role: 'USER', must_change_password: true };
jest.mock('react-router-dom', () => ({ Navigate: ({ to }) => <div>Redirect to {to}</div>, useLocation: () => ({ pathname: mockPath }) }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false, hasAccess: () => true }) }));
jest.mock('./common/MuriLoader', () => () => null);

beforeEach(() => { mockPath = '/user-dashboard'; mockUser = { role: 'USER', must_change_password: true }; });
test.each(['/user-dashboard', '/settings', '/data-assets'])('requires a password change on direct navigation to %s', (path) => {
  mockPath = path;
  render(<ProtectedRoute><div>Protected content</div></ProtectedRoute>);
  expect(screen.getByText('Redirect to /change-password')).toBeTruthy();
  expect(screen.queryByText('Protected content')).toBeNull();
});
test('allows the mandatory password page and permits the dashboard after a change', () => {
  mockPath = '/change-password';
  const view = render(<ProtectedRoute><div>Password form</div></ProtectedRoute>);
  expect(screen.getByText('Password form')).toBeTruthy();
  view.unmount();
  mockUser = { role: 'USER', must_change_password: false };
  mockPath = '/user-dashboard';
  render(<ProtectedRoute><div>Dashboard</div></ProtectedRoute>);
  expect(screen.getByText('Dashboard')).toBeTruthy();
});
test('visiting the login page with a temporary-password session redirects to the password page', () => {
  render(<GuestRoute><div>Login</div></GuestRoute>);
  expect(screen.getByText('Redirect to /change-password')).toBeTruthy();
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ManualLoginDetails from './ManualLoginDetails';

const details = { email: 'new@icttoolsasm.com', username: 'new.user', temporary_password: 'Test-temp-234!' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('copies login details for manual emailing without storing the password in browser storage', async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { unmount } = render(<ManualLoginDetails details={details} onClose={() => {}} />);
  expect(screen.getByLabelText('Temporary password').value).toBe(details.temporary_password);
  fireEvent.click(screen.getByRole('button', { name: 'Copy login details' }));
  expect((await screen.findByRole('status')).textContent).toContain('Login details copied');
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Temporary password: ${details.temporary_password}`));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/login'));
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  unmount();
  expect(screen.queryByLabelText('Temporary password')).toBeNull();
});

test('offers manual copying when clipboard access is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('Unavailable')) } });
  const close = jest.fn();
  render(<ManualLoginDetails details={details} onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy login details' }));
  expect((await screen.findByRole('status')).textContent).toContain('Select and copy');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(close).toHaveBeenCalledTimes(1);
});

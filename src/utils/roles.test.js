import { dashboardPathForRole, displayRole } from './roles';

test.each(['VOUCHER', 'voucher', 'Voucher'])('displays the existing %s role as Logistics', (role) => {
  expect(displayRole(role)).toBe('Logistics');
  expect(dashboardPathForRole(role)).toBe('/voucher-dashboard');
});

test('preserves other roles and handles a missing role', () => {
  expect(displayRole('IT')).toBe('IT');
  expect(displayRole(null)).toBe('');
});

// Single source of truth for "which dashboard does this role land on".
// Used by LoginPage (post-login redirect), GuestRoute (bounce a logged-in
// user off /login), and ProtectedRoute (bounce a user away from a route
// their role can't see). Keep these three in sync by importing from here.

export type Role = 'admin' | 'manager' | 'it' | 'voucher' | 'user';

export const dashboardPathForRole = (role: string | null | undefined): string => {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return '/admin-dashboard';
    case 'manager':
    case 'it':
      return '/it-dashboard';
    case 'voucher':
      return '/voucher-dashboard';
    default:
      return '/user-dashboard';
  }
};

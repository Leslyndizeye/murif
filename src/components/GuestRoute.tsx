// src/components/GuestRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardPathForRole } from '../utils/roles';
import MuriLoader from './common/MuriLoader';

/**
 * Inverse of ProtectedRoute: keeps an already-logged-in user off the login
 * page (direct visit, typed URL, or browser back/forward) by bouncing them
 * to their dashboard instead.
 */
const GuestRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading }: any = useAuth();

  if (loading) {
    return <MuriLoader label="Loading…" />;
  }

  if (user) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  return <>{children}</>;
};

export default GuestRoute;

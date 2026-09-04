// src/components/ProtectedRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardPathForRole } from '../utils/roles';
import MuriLoader from './common/MuriLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = ['*']
}) => {
  const { user, loading, hasAccess }: any = useAuth();
  const location = useLocation();

  if (loading) {
    return <MuriLoader label="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAccess(requiredRoles)) {
    const target = dashboardPathForRole(user.role);
    // If the role's own dashboard is this same route (e.g. an unrecognized
    // role falling back to /user-dashboard, which itself requires 'user'),
    // redirecting again would loop forever. Let them through instead.
    if (target !== location.pathname) {
      return <Navigate to={target} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

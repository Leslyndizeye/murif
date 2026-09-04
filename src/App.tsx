// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeModeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import LoginPage from './screens/Login/LoginPage';
import UserDashboard from './screens/Dashboards/User Dashboard/userdashboard';
import VoucherPage from './screens/Voucherpage';
import Chatbot from './screens/Chatbot';
import Report from './screens/Report';
import Settings from './screens/Settings';
import DataAssets from './screens/DataAssets';
import Disposal from './screens/Disposal';
import Document from './screens/Document';
import AssetIssuance from './screens/AssetIssuance';
import ITDashboard from './screens/Dashboards/IT Dashboard/itdashboard';
import AdminDashboard from './screens/Dashboards/Admin Dashboard/admindashboard';
import VoucherDashboard from './screens/Dashboards/Voucher Dashboard/voucherdashboard';
import AdminUsers from './screens/AdminUsers';
import DepartmentsStations from './screens/DepartmentsStations';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0C5494',
      light: '#e8f4fc',
      dark: '#0a4278',
    },
    secondary: {
      main: '#0a4278',
      light: '#bfdbfe',
    },
    background: {
      default: '#f5f7fa',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Montserrat", "Inter", sans-serif',
    h1: {
      fontFamily: '"Montserrat", "Inter", sans-serif',
      fontWeight: 800,
    },
    h2: {
      fontFamily: '"Montserrat", "Inter", sans-serif',
      fontWeight: 700,
    },
    h3: {
      fontFamily: '"Montserrat", "Inter", sans-serif',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ThemeModeProvider>
        <AuthProvider>
          <Router>
            <Routes>
            <Route path="/" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            
            <Route path="/user-dashboard" element={
              <ProtectedRoute requiredRoles={['user']}>
                <UserDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/it-dashboard" element={
              <ProtectedRoute requiredRoles={['manager', 'it']}>
                <ITDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin-dashboard" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/voucher-dashboard" element={
              <ProtectedRoute requiredRoles={['voucher']}>
                <VoucherDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin/users" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            } />

            <Route path="/admin/departments-stations" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <DepartmentsStations />
              </ProtectedRoute>
            } />

            <Route path="/voucher" element={
              <ProtectedRoute requiredRoles={['*']}>
                <VoucherPage />
              </ProtectedRoute>
            } />
            
            <Route path="/chatbot" element={
              <ProtectedRoute requiredRoles={['*']}>
                <Chatbot />
              </ProtectedRoute>
            } />
            
            <Route path="/report" element={
              <ProtectedRoute requiredRoles={['*']}>
                <Report />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute requiredRoles={['*']}>
                <Settings />
              </ProtectedRoute>
            } />

            <Route path="/settings/it" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'it']}>
                <Settings />
              </ProtectedRoute>
            } />
            
            <Route path="/data-assets" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'it', 'voucher']}>
                <DataAssets />
              </ProtectedRoute>
            } />
            
            <Route path="/disposal" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'it']}>
                <Disposal />
              </ProtectedRoute>
            } />

            <Route path="/asset-issuance" element={
              <ProtectedRoute requiredRoles={['admin', 'manager', 'it', 'voucher']}>
                <AssetIssuance />
              </ProtectedRoute>
            } />

            <Route path="/document" element={
              <ProtectedRoute requiredRoles={['*']}>
                <Document />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<GuestRoute><LoginPage /></GuestRoute>} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeModeProvider>
    </ThemeProvider>
  );
}

export default App;
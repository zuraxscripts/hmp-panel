import React from 'react';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';

declare global {
  interface Window {
    __HMP_PAGE__?: string;
  }
}

export function App() {
  const page = window.__HMP_PAGE__ || '';
  const path = window.location.pathname;

  if (page === 'login' || path === '/login') return <LoginPage />;
  if (page === 'setup' || path === '/setup') return <SetupPage />;
  if (page === 'change-password' || path === '/change-password') return <ChangePasswordPage />;
  return <DashboardPage />;
}

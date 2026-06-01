import React from 'react';
import PageBoundary from './PageBoundary.jsx';

export default function SuperAdminDashboardPage({ children }) {
  return <PageBoundary name="super-admin-dashboard">{children}</PageBoundary>;
}

import React from 'react';
import PageBoundary from './PageBoundary.jsx';

export default function AdminDashboardPage({ children }) {
  return <PageBoundary name="admin-dashboard">{children}</PageBoundary>;
}

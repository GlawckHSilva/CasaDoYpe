import React from 'react';
import PageBoundary from './PageBoundary.jsx';

export default function LoginPage({ children }) {
  return <PageBoundary name="login">{children}</PageBoundary>;
}

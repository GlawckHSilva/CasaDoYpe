import React from 'react';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

export default function PageBoundary({ name, children }) {
  return <ErrorBoundary resetKey={name}>{children}</ErrorBoundary>;
}

import React from 'react';
import PageBoundary from './PageBoundary.jsx';

export default function HomePage({ children }) {
  return <PageBoundary name="home">{children}</PageBoundary>;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './index.css';
import ReactDOM from 'react-dom/client';
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { DesignStudio } from './components/DesignStudio';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

function RootRoute() {
  const location = useLocation();
  return location.pathname === '/design-studio' ? <DesignStudio /> : <App />;
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>
      <RootRoute />
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);

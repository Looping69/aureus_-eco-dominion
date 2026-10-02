/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './index.css';
import ReactDOM from 'react-dom/client';
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter, useLocation } from 'react-router-dom';
const App = React.lazy(() => import('./App'));
const SampleColonyUi = React.lazy(() => import('./game-definitions/sampleColonyUi'));
import { PACK_RUNTIME_REGISTRY } from './game-definitions/runtimeRegistry';
const DesignStudio = React.lazy(() => import('./components/DesignStudio').then(module => ({ default: module.DesignStudio })));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

function RootRoute() {
  const location = useLocation();
  const packId = new URLSearchParams(location.search).get('pack') ?? (location.pathname === '/sample-colony' ? 'sample.micro-colony' : 'aureus.eco-dominion');
  if (!PACK_RUNTIME_REGISTRY.has(packId)) return <main role="alert">Unknown game pack: {packId}</main>;
  if (packId === 'sample.micro-colony') return <SampleColonyUi />;
  return location.pathname === '/design-studio' ? <DesignStudio /> : <App />;
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>
      <React.Suspense fallback={<p role="status">Loading game…</p>}><RootRoute /></React.Suspense>
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);

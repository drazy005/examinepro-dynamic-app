
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SystemProvider } from './services/SystemContext';
import { ToastProvider } from './services/ToastContext';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SystemProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SystemProvider>
  </React.StrictMode>
);

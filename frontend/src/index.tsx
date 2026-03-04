import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/print.css';

// Clear old caches on app startup (prevents offline showing stale data)
const bustCache = async () => {
  try {
    const cacheNames = await caches.keys();
    const currentVersion = localStorage.getItem('app_version') || '1.0.0';
    
    for (const name of cacheNames) {
      // Delete all caches that don't match current version
      if (!name.includes(currentVersion)) {
        console.log(`[App] Clearing old cache: ${name}`);
        await caches.delete(name);
      }
    }
    console.log('[App] Cache cleanup complete');
  } catch (error) {
    console.error('[App] Cache cleanup error:', error);
  }
};

// Service Worker for PWA and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Bust old caches before registering new service worker
    await bustCache();
    
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered successfully:', reg.scope);
      
      // Check for updates every 30 seconds
      setInterval(() => {
        reg.update().then(() => {
          if (reg.waiting) {
            console.log('[App] Service Worker update available');
            // Notify user that update is ready
            localStorage.setItem('sw_update_ready', 'true');
            window.dispatchEvent(new Event('sw_update_ready'));
          }
        });
      }, 30000);
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

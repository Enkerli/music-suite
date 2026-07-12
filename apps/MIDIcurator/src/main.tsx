import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@enkerli/ui/tokens.css';
import '@enkerli/ui/fonts.css';
import '@enkerli/ui/components.css'; // .es-device-* / .es-control (MIDI-out selector)
import { initTheme } from '@enkerli/ui/theme';
import './App.css';

// Apply the persisted theme choice on load (the cluster's toggle only covers
// subsequent flips) — this call was lost when ThemeToggle.tsx retired.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

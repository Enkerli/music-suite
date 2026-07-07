import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@enkerli/ui/tokens.css';
import '@enkerli/ui/components.css'; // .es-device-* / .es-control (MIDI-out selector)
import './App.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppConfigProvider } from './context/AppConfigContext.jsx'

// Offline support for lab tablets (public/sw.js). Dev keeps plain network behaviour.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </StrictMode>,
)

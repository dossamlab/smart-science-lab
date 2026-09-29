import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AppConfigProvider } from './context/AppConfigContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </StrictMode>,
)

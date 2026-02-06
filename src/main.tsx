import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App, PreferencesProvider } from '@app'
import { migrateFromLocalStorage } from '@lib'

// One-time migration: localStorage → IndexedDB (fire-and-forget).
migrateFromLocalStorage().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </BrowserRouter>
  </StrictMode>,
)

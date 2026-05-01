import React from 'react'
import ReactDOM from 'react-dom/client'
import './web-bridge'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { MotivationProvider } from './contexts/MotivationContext'
import './styles/globals.css'
import './styles/app-effects.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <MotivationProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MotivationProvider>
    </LanguageProvider>
  </ErrorBoundary>
)

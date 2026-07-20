import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3157d5', light: '#e9efff' },
    secondary: { main: '#7c3aed' },
    background: { default: '#f5f7fb' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', h4: { letterSpacing: '-0.03em' } },
  components: {
    MuiCard: { styleOverrides: { root: { border: '1px solid #e6eaf2', boxShadow: '0 8px 24px rgba(31,45,80,.06)' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

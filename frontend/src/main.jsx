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
    primary: { main: '#3157d5' },
    background: { default: '#f5f7fb' },
  },
  shape: { borderRadius: 10 },
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

import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const links = [
  ['/dashboard', 'Dashboard'],
  ['/documents', 'Documents'],
  ['/chat', 'Chat'],
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            AI Knowledge Assistant
          </Typography>
          {links.map(([path, label]) => (
            <Button key={path} color="inherit" component={NavLink} to={path}>
              {label}
            </Button>
          ))}
          <Typography variant="body2" sx={{ mx: 1 }}>{user?.email}</Typography>
          <Button color="inherit" variant="outlined" onClick={signOut}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}><Outlet /></Container>
    </Box>
  )
}

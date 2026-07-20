import { AppBar, Avatar, Box, Button, Chip, Container, Menu, MenuItem, Toolbar, Typography } from '@mui/material'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState(null)
  const links = [['/dashboard', 'Dashboard'], ['/documents', 'Documents'], ['/chat', 'Chat']]
  if (user?.role === 'admin') links.push(['/admin', 'Admin'])

  const signOut = () => {
    setAnchor(null); logout(); navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f4f7ff 0%, #f8fafc 45%)' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,.94)', color: 'text.primary', borderBottom: 1, borderColor: 'divider', backdropFilter: 'blur(12px)' }}>
        <Toolbar sx={{ gap: 1 }}>
          <Box display="flex" alignItems="center" gap={1.25} sx={{ flexGrow: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontWeight: 800 }}>K</Avatar>
            <Typography variant="h6" fontWeight={800}>Knowledge Assistant</Typography>
          </Box>
          {links.map(([path, label]) => <Button key={path} color="inherit" component={NavLink} to={path} sx={{ '&.active': { color: 'primary.main', bgcolor: 'primary.light' } }}>{label}</Button>)}
          <Button color="inherit" onClick={(event) => setAnchor(event.currentTarget)} sx={{ textTransform: 'none', ml: 1 }}>
            <Avatar sx={{ width: 30, height: 30, mr: 1, bgcolor: 'secondary.main' }}>{user?.email?.[0]?.toUpperCase()}</Avatar>
            <Box textAlign="left"><Typography variant="body2" fontWeight={700} lineHeight={1.1}>{user?.email}</Typography><Chip label={user?.role || 'viewer'} size="small" color={user?.role === 'admin' ? 'secondary' : 'default'} sx={{ height: 18, mt: .4 }} /></Box>
          </Button>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem disabled>Profile · {user?.email}</MenuItem>
            {user?.role === 'admin' && <MenuItem onClick={() => { setAnchor(null); navigate('/settings') }}>Settings</MenuItem>}
            <MenuItem onClick={signOut}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}><Outlet /></Container>
    </Box>
  )
}

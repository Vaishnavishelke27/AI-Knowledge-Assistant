import { Box, Link } from '@mui/material'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import useAuth from '../hooks/useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.state?.from?.pathname || '/dashboard'

  const submit = async (email, password) => {
    await login(email, password)
    navigate(destination, { replace: true })
  }

  return (
    <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', p: 2 }}>
      <AuthForm title="Welcome back" submitLabel="Sign in" onSubmit={submit} footer={<>Need an account? <Link component={RouterLink} to="/register">Register</Link></>} />
    </Box>
  )
}

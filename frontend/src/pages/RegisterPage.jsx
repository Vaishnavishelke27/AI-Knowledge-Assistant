import { Box, Link } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import useAuth from '../hooks/useAuth'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const submit = async (email, password) => {
    await register(email, password)
    navigate('/dashboard', { replace: true })
  }

  return (
    <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', p: 2 }}>
      <AuthForm title="Create account" submitLabel="Register" onSubmit={submit} footer={<>Already registered? <Link component={RouterLink} to="/login">Sign in</Link></>} />
    </Box>
  )
}

import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useState } from 'react'

export default function AuthForm({ title, submitLabel, onSubmit, footer }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit(email, password)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to complete the request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paper component="form" onSubmit={submit} elevation={3} sx={{ p: 4, width: '100%', maxWidth: 430 }}>
      <Typography variant="h4" fontWeight={700} mb={3}>{title}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth required margin="normal" />
      <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} inputProps={{ minLength: 8, maxLength: 72 }} fullWidth required margin="normal" />
      <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth sx={{ mt: 3 }}>
        {loading ? 'Please wait…' : submitLabel}
      </Button>
      <Box mt={2} textAlign="center">{footer}</Box>
    </Paper>
  )
}

import { Alert, Box, Chip, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../services/apiService'
import apiService from '../services/apiService'

export default function Settings() {
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { apiService.get('/admin/user-activity').then(({ data }) => setActivity(data)).catch((requestError) => setError(requestError.response?.data?.detail || 'Could not load users.')) }, [])
  const users = useMemo(() => Object.values(activity.reduce((result, item) => {
    const existing = result[item.user_id] || { id: item.user_id, email: item.email, queries: 0, lastActive: item.date }
    existing.queries += item.query_count
    if (item.date > existing.lastActive) existing.lastActive = item.date
    result[item.user_id] = existing
    return result
  }, {})), [activity])

  return (
    <Box>
      <Typography variant="h4" fontWeight={800}>Settings</Typography><Typography color="text.secondary" mb={3}>Administration and runtime configuration.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}><Paper sx={{ p: 3 }}><Typography variant="h6" mb={2}>Users with query activity</Typography><Table size="small"><TableHead><TableRow><TableCell>User</TableCell><TableCell align="right">Queries</TableCell><TableCell>Last active</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell>{user.email}</TableCell><TableCell align="right">{user.queries}</TableCell><TableCell>{user.lastActive}</TableCell><TableCell><Chip label="Active" color="success" size="small" /></TableCell></TableRow>)}{!users.length && <TableRow><TableCell colSpan={4} align="center">No user activity recorded.</TableCell></TableRow>}</TableBody></Table><Typography variant="caption" color="text.secondary">User role mutation is unavailable until a backend user-management endpoint is added.</Typography></Paper></Grid>
        <Grid size={{ xs: 12, lg: 4 }}><Paper sx={{ p: 3 }}><Typography variant="h6" mb={2}>System configuration</Typography><Typography variant="overline" color="text.secondary">API endpoint</Typography><Typography sx={{ wordBreak: 'break-all' }} mb={2}>{API_BASE_URL}</Typography><Typography variant="overline" color="text.secondary">Vector collection</Typography><Typography mb={2}>knowledge_base</Typography><Typography variant="overline" color="text.secondary">Authentication</Typography><Typography mb={2}>JWT bearer tokens</Typography><Chip label="Configuration is environment-managed" variant="outlined" /></Paper></Grid>
      </Grid>
    </Box>
  )
}

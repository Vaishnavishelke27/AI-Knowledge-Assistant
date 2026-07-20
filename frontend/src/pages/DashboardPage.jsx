import { Card, CardContent, Grid, Typography } from '@mui/material'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const data = [{ name: 'Documents', value: 0 }, { name: 'Queries', value: 0 }, { name: 'Conversations', value: 0 }]

export default function DashboardPage() {
  return (
    <>
      <Typography variant="h4" fontWeight={700} mb={1}>Dashboard</Typography>
      <Typography color="text.secondary" mb={3}>Your knowledge workspace at a glance.</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card><CardContent sx={{ height: 320 }}>
            <Typography variant="h6" mb={2}>Workspace activity</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={data}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#3157d5" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card><CardContent><Typography variant="h6">Getting started</Typography><Typography color="text.secondary" mt={1}>Upload enterprise documents, then ask grounded questions in Chat.</Typography></CardContent></Card>
        </Grid>
      </Grid>
    </>
  )
}

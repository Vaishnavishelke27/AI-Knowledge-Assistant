import { Alert, Box, Card, CardContent, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import apiService from '../services/apiService'

const today = new Date().toISOString().slice(0, 10)

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [documents, setDocuments] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiService.get('/admin/stats'),
      apiService.get('/admin/user-activity'),
      apiService.get('/admin/document-usage'),
      apiService.get('/admin/feedback-summary'),
    ]).then(([statsResponse, activityResponse, documentResponse, feedbackResponse]) => {
      setStats(statsResponse.data); setActivity(activityResponse.data); setDocuments(documentResponse.data); setFeedback(feedbackResponse.data)
    }).catch((requestError) => setError(requestError.response?.data?.detail || 'Could not load admin analytics.'))
  }, [])

  const dailyActivity = useMemo(() => {
    const totals = activity.reduce((result, item) => ({ ...result, [item.date]: (result[item.date] || 0) + item.query_count }), {})
    return Object.entries(totals).sort(([left], [right]) => left.localeCompare(right)).map(([date, queries]) => ({ date, queries }))
  }, [activity])
  const queriesToday = activity.filter((item) => item.date === today).reduce((total, item) => total + item.query_count, 0)
  const cards = [
    ['Total users', stats?.total_users ?? '—'],
    ['Documents', stats?.total_documents ?? '—'],
    ['Queries today', queriesToday],
    ['Avg response', stats ? `${stats.avg_response_time_ms} ms` : '—'],
  ]

  return (
    <Box>
      <Typography variant="h4" fontWeight={800}>Admin dashboard</Typography>
      <Typography color="text.secondary" mb={3}>System health, adoption, and answer quality.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2} mb={3}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h4" fontWeight={800}>{value}</Typography></CardContent></Card></Grid>)}</Grid>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}><Paper sx={{ p: 3, height: 360 }}><Typography variant="h6" mb={2}>User activity</Typography><ResponsiveContainer width="100%" height="88%"><LineChart data={dailyActivity}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="queries" stroke="#3157d5" strokeWidth={3} /></LineChart></ResponsiveContainer></Paper></Grid>
        <Grid size={{ xs: 12, lg: 6 }}><Paper sx={{ p: 3, height: 360 }}><Typography variant="h6" mb={2}>Most queried documents</Typography><ResponsiveContainer width="100%" height="88%"><BarChart data={documents.slice(0, 8)} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="filename" width={120} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="query_count" fill="#19a974" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></Paper></Grid>
        <Grid size={{ xs: 12 }}><Paper sx={{ p: 3 }}><Typography variant="h6">Feedback summary</Typography><Typography color="text.secondary" mb={2}>{feedback?.total_feedback || 0} ratings · Average {feedback?.average_rating || 0}/5</Typography><Table size="small"><TableHead><TableRow><TableCell>Rating</TableCell><TableCell align="right">Responses</TableCell><TableCell align="right">Share</TableCell></TableRow></TableHead><TableBody>{[5, 4, 3, 2, 1].map((rating) => { const count = feedback?.rating_distribution?.[String(rating)] || 0; const share = feedback?.total_feedback ? Math.round((count / feedback.total_feedback) * 100) : 0; return <TableRow key={rating}><TableCell>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</TableCell><TableCell align="right">{count}</TableCell><TableCell align="right">{share}%</TableCell></TableRow> })}</TableBody></Table></Paper></Grid>
      </Grid>
    </Box>
  )
}

import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Rating, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import apiService from '../services/apiService'

export default function FeedbackModal({ open, messageId, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setRating(0); setComment(''); setError('') }
  }, [open])

  const submit = async () => {
    if (!rating) { setError('Select a rating before submitting.'); return }
    setSaving(true); setError('')
    try {
      const { data } = await apiService.post('/feedback', { message_id: messageId, rating, comment: comment.trim() || null })
      onSubmitted?.(data)
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not submit feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rate this response</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Rating value={rating} onChange={(_, value) => setRating(value || 0)} size="large" />
          <Typography color="text.secondary">{rating ? `${rating} of 5` : 'Choose a rating'}</Typography>
        </Box>
        <TextField label="Comment (optional)" value={comment} onChange={(event) => setComment(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 2000 }} fullWidth />
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Submit feedback'}</Button></DialogActions>
    </Dialog>
  )
}

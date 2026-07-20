import { Alert, Box, Button, LinearProgress, Paper, Typography } from '@mui/material'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import apiService from '../services/apiService'

const acceptedFiles = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
}

export default function UploadDocument({ onUploaded }) {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const upload = async ([file]) => {
    if (!file) return
    setUploading(true); setProgress(0); setError('')
    const form = new FormData(); form.append('file', file)
    try {
      const { data } = await apiService.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: ({ loaded, total }) => setProgress(total ? Math.round((loaded * 100) / total) : 0),
      })
      setProgress(100)
      onUploaded?.(data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Document upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: upload,
    accept: acceptedFiles,
    multiple: false,
    noClick: true,
    disabled: uploading,
  })

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper {...getRootProps()} variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed', bgcolor: isDragActive ? 'action.hover' : 'background.paper' }}>
        <input {...getInputProps()} />
        <Typography variant="h6">Drop PDF, DOCX, XLSX, or PPTX files here</Typography>
        <Typography color="text.secondary" mb={2}>Documents are parsed, chunked, and indexed automatically.</Typography>
        <Button variant="contained" onClick={open} disabled={uploading}>{uploading ? 'Uploading…' : 'Choose document'}</Button>
        {uploading && <Box mt={3}><LinearProgress variant="determinate" value={progress} /><Typography variant="caption">{progress}% uploaded</Typography></Box>}
      </Paper>
    </Box>
  )
}

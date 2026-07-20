import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import apiService from '../services/apiService'

export default function DocumentsPage() {
  const [status, setStatus] = useState(null)
  const onDrop = async ([file]) => {
    if (!file) return
    const form = new FormData(); form.append('file', file)
    try {
      const { data } = await apiService.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStatus({ severity: 'success', text: `${data.filename} indexed (${data.chunk_count} chunks).` })
    } catch (error) {
      setStatus({ severity: 'error', text: error.response?.data?.detail || 'Upload failed.' })
    }
  }
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, noClick: true, accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } })
  return <><Typography variant="h4" fontWeight={700} mb={1}>Documents</Typography><Typography color="text.secondary" mb={3}>Upload PDF, DOCX, XLSX, or PPTX knowledge sources.</Typography>{status && <Alert severity={status.severity} sx={{ mb: 2 }}>{status.text}</Alert>}<Paper {...getRootProps()} variant="outlined" sx={{ p: 8, textAlign: 'center', borderStyle: 'dashed', bgcolor: isDragActive ? 'action.hover' : 'background.paper' }}><input {...getInputProps()} /><Box><Typography variant="h6">Drop a document here</Typography><Typography color="text.secondary" mb={2}>or select one from your computer</Typography><Button variant="contained" onClick={open}>Choose file</Button></Box></Paper></>
}

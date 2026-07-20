import { Alert, Box, Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import UploadDocument from '../components/UploadDocument'
import useAuth from '../hooks/useAuth'
import apiService from '../services/apiService'

export default function Documents() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDocuments = useCallback(async () => {
    try {
      const { data } = await apiService.get('/documents')
      setDocuments(data)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Could not load documents.')
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const removeDocument = async (document) => {
    if (!window.confirm(`Delete ${document.filename}?`)) return
    try {
      await apiService.delete(`/documents/${document.id}`)
      setDocuments((items) => items.filter((item) => item.id !== document.id))
      setNotice(`${document.filename} deleted.`)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Delete failed.')
    }
  }

  const uploaded = (document) => {
    setNotice(`${document.filename} indexed successfully.`)
    loadDocuments()
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>Documents</Typography>
      <Typography color="text.secondary" mb={3}>Manage the files available to the knowledge assistant.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
      <UploadDocument onUploaded={uploaded} />
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead><TableRow><TableCell>Filename</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell><TableCell>Chunks</TableCell><TableCell>Created</TableCell>{user?.role === 'admin' && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id} hover>
                <TableCell>{document.filename}</TableCell>
                <TableCell>{document.file_type.replace('.', '').toUpperCase()}</TableCell>
                <TableCell><Chip size="small" color={document.status === 'indexed' ? 'success' : 'default'} label={document.status} /></TableCell>
                <TableCell>{document.chunk_count}</TableCell>
                <TableCell>{new Date(document.created_at).toLocaleString()}</TableCell>
                {user?.role === 'admin' && <TableCell align="right"><Tooltip title="Delete document"><IconButton color="error" onClick={() => removeDocument(document)} aria-label={`Delete ${document.filename}`}>×</IconButton></Tooltip></TableCell>}
              </TableRow>
            ))}
            {!documents.length && <TableRow><TableCell colSpan={user?.role === 'admin' ? 6 : 5} align="center"><Typography color="text.secondary" py={3}>No documents uploaded.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

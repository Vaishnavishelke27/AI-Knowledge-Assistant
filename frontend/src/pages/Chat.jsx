import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Divider, Link, List, ListItemButton, ListItemText, Paper, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import FeedbackModal from '../components/FeedbackModal'
import useChat from '../hooks/useChat'
import apiService from '../services/apiService'

const citationLocation = (citation) => {
  if (citation.page != null) return `Page ${citation.page}`
  if (citation.slide != null) return `Slide ${citation.slide}`
  return citation.chunk_index != null ? `Chunk ${citation.chunk_index}` : 'Source document'
}

export default function Chat() {
  const [conversations, setConversations] = useState([])
  const [question, setQuestion] = useState('')
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [feedbackMessageId, setFeedbackMessageId] = useState(null)
  const [ratedMessages, setRatedMessages] = useState(() => new Set())
  const endRef = useRef(null)

  const refreshConversations = useCallback(async () => {
    const { data } = await apiService.get('/conversations')
    setConversations(data)
  }, [])
  const { conversationId, messages, sending, error, newConversation, loadConversation, sendMessage } = useChat(refreshConversations)

  useEffect(() => { refreshConversations().catch(() => setConversations([])) }, [refreshConversations])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const submit = (event) => {
    event.preventDefault()
    if (!question.trim()) return
    sendMessage(question)
    setQuestion('')
  }

  return (
    <Paper sx={{ display: 'flex', height: 'calc(100vh - 130px)', overflow: 'hidden' }}>
      <Box sx={{ width: 280, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box p={2}><Button variant="contained" fullWidth onClick={newConversation}>New conversation</Button></Box>
        <Divider />
        <List sx={{ overflowY: 'auto' }}>
          {conversations.map((conversation) => (
            <ListItemButton key={conversation.id} selected={conversation.id === conversationId} onClick={() => loadConversation(conversation.id)}>
              <ListItemText primary={conversation.title} secondary={new Date(conversation.created_at).toLocaleDateString()} primaryTypographyProps={{ noWrap: true }} />
            </ListItemButton>
          ))}
          {!conversations.length && <Typography color="text.secondary" p={2}>No conversations yet.</Typography>}
        </List>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {!messages.length && <Box textAlign="center" mt={10}><Typography variant="h5">Ask your knowledge base</Typography><Typography color="text.secondary">Answers include traceable document citations.</Typography></Box>}
          {messages.map((message) => (
            <Box key={message.id} sx={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', mb: 2 }}>
              <Box sx={{ maxWidth: '78%', px: 2.5, py: 1.5, borderRadius: 2, bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary' }}>
                {message.content ? <ReactMarkdown>{message.content}</ReactMarkdown> : <Typography color="text.secondary">Thinking…</Typography>}
                {message.role === 'assistant' && message.citations?.length > 0 && (
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {message.citations.map((citation) => (
                      <Link key={`${message.id}-${citation.id}`} component="button" type="button" onClick={() => setSelectedCitation(citation)} underline="hover">
                        [{citation.id}] {citation.filename}
                      </Link>
                    ))}
                  </Box>
                )}
                {message.role === 'assistant' && typeof message.id === 'number' && (
                  <Button size="small" sx={{ mt: 1, px: 0 }} onClick={() => setFeedbackMessageId(message.id)} disabled={ratedMessages.has(message.id)}>
                    {ratedMessages.has(message.id) ? 'Feedback submitted' : 'Rate this response'}
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          <div ref={endRef} />
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Box component="form" onSubmit={submit} sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <TextField value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about your documents…" fullWidth multiline maxRows={4} disabled={sending} />
          <Button type="submit" variant="contained" disabled={sending || !question.trim()}>Send</Button>
        </Box>
      </Box>

      <Dialog open={Boolean(selectedCitation)} onClose={() => setSelectedCitation(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Source [{selectedCitation?.id}]</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700}>{selectedCitation?.filename}</Typography>
          <Typography>{selectedCitation && citationLocation(selectedCitation)}</Typography>
          {selectedCitation?.document_id != null && <Typography color="text.secondary">Document ID: {selectedCitation.document_id}</Typography>}
          {selectedCitation?.score != null && <Typography color="text.secondary">Relevance: {(selectedCitation.score * 100).toFixed(1)}%</Typography>}
        </DialogContent>
      </Dialog>
      <FeedbackModal open={feedbackMessageId != null} messageId={feedbackMessageId} onClose={() => setFeedbackMessageId(null)} onSubmitted={() => setRatedMessages((items) => new Set(items).add(feedbackMessageId))} />
    </Paper>
  )
}

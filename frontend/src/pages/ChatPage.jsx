import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import apiService from '../services/apiService'

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const ask = async (event) => {
    event.preventDefault(); const text = question.trim(); if (!text) return
    setQuestion(''); setError(''); setMessages((items) => [...items, { role: 'user', content: text }])
    try {
      const { data } = await apiService.post('/ask', { question: text, conversation_id: conversationId })
      setConversationId(data.conversation_id); setMessages((items) => [...items, { role: 'assistant', content: data.answer }])
    } catch (requestError) { setError(requestError.response?.data?.detail || 'The assistant is unavailable.') }
  }
  return <><Typography variant="h4" fontWeight={700} mb={1}>Chat</Typography><Typography color="text.secondary" mb={3}>Ask questions grounded in your indexed documents.</Typography>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Paper sx={{ p: 3, minHeight: 420, mb: 2 }}>{messages.length === 0 && <Typography color="text.secondary">Start a conversation with your knowledge base.</Typography>}{messages.map((message, index) => <Box key={`${message.role}-${index}`} sx={{ ml: message.role === 'user' ? 'auto' : 0, mb: 2, p: 2, maxWidth: '80%', borderRadius: 2, bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100', color: message.role === 'user' ? 'primary.contrastText' : 'text.primary' }}><ReactMarkdown>{message.content}</ReactMarkdown></Box>)}</Paper><Box component="form" onSubmit={ask} display="flex" gap={1}><TextField value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your documents…" fullWidth /><Button type="submit" variant="contained">Ask</Button></Box></>
}

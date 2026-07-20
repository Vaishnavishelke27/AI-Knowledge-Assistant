import { useCallback, useState } from 'react'
import apiService, { ACCESS_TOKEN_KEY, API_BASE_URL } from '../services/apiService'

const normalizeMessage = (message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  citations: message.citations || [],
})

export default function useChat(onConversationChange) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError('')
  }, [])

  const loadConversation = useCallback(async (id) => {
    setError('')
    const { data } = await apiService.get(`/conversations/${id}/messages`)
    setConversationId(id)
    setMessages(data.map(normalizeMessage))
  }, [])

  const sendMessage = useCallback(async (question) => {
    const text = question.trim()
    if (!text || sending) return
    const pendingId = `pending-${Date.now()}`
    setSending(true)
    setError('')
    setMessages((items) => [
      ...items,
      { id: `user-${Date.now()}`, role: 'user', content: text, citations: [] },
      { id: pendingId, role: 'assistant', content: '', citations: [] },
    ])

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`,
        },
        body: JSON.stringify({ question: text, conversation_id: conversationId, stream: true }),
      })
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'The assistant is unavailable.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const handleEvent = (block) => {
        const event = block.match(/^event:\s*(.+)$/m)?.[1]
        const rawData = block.match(/^data:\s*(.+)$/m)?.[1]
        if (!event || !rawData) return
        const data = JSON.parse(rawData)
        if (event === 'answer') {
          setMessages((items) => items.map((item) => item.id === pendingId ? { ...item, content: item.content + data.text } : item))
        } else if (event === 'citations') {
          setMessages((items) => items.map((item) => item.id === pendingId ? { ...item, citations: data } : item))
        } else if (event === 'conversation') {
          setConversationId(data.conversation_id)
        } else if (event === 'message') {
          setMessages((items) => items.map((item) => item.id === pendingId ? { ...item, id: data.message_id } : item))
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''
        blocks.forEach(handleEvent)
        if (done) break
      }
      if (buffer.trim()) handleEvent(buffer)
      onConversationChange?.()
    } catch (requestError) {
      setMessages((items) => items.filter((item) => item.id !== pendingId))
      setError(requestError.message || 'The assistant is unavailable.')
    } finally {
      setSending(false)
    }
  }, [conversationId, onConversationChange, sending])

  return { conversationId, messages, sending, error, newConversation, loadConversation, sendMessage }
}

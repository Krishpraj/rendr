import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage, Parameter, PipelineStage } from '@/types'
import { api } from '@/lib/api'

interface ChatContextValue {
  messages: ChatMessage[]
  addMessage: (
    role: 'user' | 'assistant' | 'system',
    content: string,
    extra?: { code?: string; parameters?: Parameter[]; pipelineStages?: PipelineStage[] }
  ) => ChatMessage
  updateLastAssistant: (
    content: string,
    extra?: { code?: string; parameters?: Parameter[]; pipelineStages?: PipelineStage[] }
  ) => void
  clearMessages: () => void
  loadMessages: (projectId: string) => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  currentStage: PipelineStage | null
  setCurrentStage: (stage: PipelineStage | null) => void
  streamCompletedStages: PipelineStage[]
  setStreamCompletedStages: (stages: PipelineStage[]) => void
  projectId: string | null
  setProjectId: (id: string | null) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null)
  const [streamCompletedStages, setStreamCompletedStages] = useState<PipelineStage[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)

  const loadMessages = useCallback((pid: string) => {
    setProjectId(pid)
    api
      .getMessages(pid)
      .then((msgs) => setMessages(msgs))
      .catch((err) => {
        console.error('Failed to load messages:', err)
        setMessages([])
      })
  }, [])

  const addMessage = useCallback(
    (
      role: 'user' | 'assistant' | 'system',
      content: string,
      extra?: { code?: string; parameters?: Parameter[]; pipelineStages?: PipelineStage[] }
    ) => {
      const msg: ChatMessage = {
        id: uuid(),
        role,
        content,
        timestamp: new Date().toISOString(),
        ...extra
      }
      setMessages((prev) => [...prev, msg])
      // Persist to backend
      if (projectId) {
        api.saveMessage(projectId, msg).catch((err) => console.error('Failed to save message:', err))
      }
      return msg
    },
    [projectId]
  )

  const updateLastAssistant = useCallback(
    (
      content: string,
      extra?: { code?: string; parameters?: Parameter[]; pipelineStages?: PipelineStage[] }
    ) => {
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === 'assistant')
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        const updated = [...prev]
        const updatedMsg = { ...updated[realIdx], content, ...extra }
        updated[realIdx] = updatedMsg
        // Persist updated message to backend
        if (projectId) {
          api.saveMessage(projectId, updatedMsg).catch((err) => console.error('Failed to update message:', err))
        }
        return updated
      })
    },
    [projectId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    if (projectId) {
      api.deleteMessages(projectId).catch((err) => console.error('Failed to delete messages:', err))
    }
  }, [projectId])

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        updateLastAssistant,
        clearMessages,
        loadMessages,
        isStreaming,
        setIsStreaming,
        currentStage,
        setCurrentStage,
        streamCompletedStages,
        setStreamCompletedStages,
        projectId,
        setProjectId
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

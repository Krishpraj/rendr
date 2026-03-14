import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage, Parameter, PipelineStage } from '@/types'

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
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void
  currentStage: PipelineStage | null
  setCurrentStage: (stage: PipelineStage | null) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null)

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
      return msg
    },
    []
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
        updated[realIdx] = { ...updated[realIdx], content, ...extra }
        return updated
      })
    },
    []
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        updateLastAssistant,
        clearMessages,
        isStreaming,
        setIsStreaming,
        currentStage,
        setCurrentStage
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

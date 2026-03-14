import { useRef, useEffect, useState } from 'react'
import { useChat } from '@/contexts/ChatContext'
import { useProject } from '@/contexts/ProjectContext'
import { useEditStream } from '@/hooks/useEditStream'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { ArrowUp, Loader2, ChevronDown, Zap, Sparkles } from 'lucide-react'
import type { PipelineStage } from '@/types'

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'analyze_and_plan', label: 'Analyze' },
  { key: 'generate', label: 'Generate' },
  { key: 'validate', label: 'Validate' },
  { key: 'review', label: 'Review' },
  { key: 'complete', label: 'Done' }
]

const MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', short: 'Sonnet' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', short: 'Haiku' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', short: 'Opus' }
]

type Mode = 'normal' | 'fast'

function PipelineProgress({
  completedStages,
  currentStage
}: {
  completedStages?: PipelineStage[]
  currentStage: PipelineStage | null
}) {
  if (!currentStage && (!completedStages || completedStages.length === 0)) return null

  return (
    <div className="flex items-center gap-2 py-1.5">
      {STAGES.map(({ key, label }) => {
        const isDone =
          completedStages?.includes(key) ||
          (key === 'complete' && !currentStage && completedStages && completedStages.length > 0)
        const isActive = currentStage === key
        return (
          <div key={key} className="flex items-center gap-1">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                isDone
                  ? 'bg-r-success'
                  : isActive
                    ? 'bg-r-accent animate-pulse-dot'
                    : 'bg-r-text-dim/30'
              }`}
            />
            <span
              className={`text-2xs transition-colors ${
                isDone ? 'text-r-success' : isActive ? 'text-r-accent' : 'text-r-text-dim/50'
              }`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ChatPanel() {
  const { messages, isStreaming, currentStage } = useChat()
  const { currentProject, initialPrompt, setInitialPrompt } = useProject()
  const { sendPrompt } = useEditStream()
  const health = useBackendHealth()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('normal')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialPromptSent = useRef(false)

  // Auto-send initial prompt from welcome screen
  useEffect(() => {
    if (initialPrompt && currentProject && !initialPromptSent.current && !isStreaming) {
      initialPromptSent.current = true
      const text = initialPrompt
      setInitialPrompt(null)
      sendPrompt(text, {
        model: selectedModel || undefined,
        skipValidation: mode === 'fast',
        skipRefinement: mode === 'fast'
      })
    }
  }, [initialPrompt, currentProject, isStreaming, sendPrompt, setInitialPrompt, selectedModel, mode])

  const activeModelId = selectedModel || health.data?.model || MODELS[0].id
  const activeModelEntry = MODELS.find((m) => m.id === activeModelId) ||
    MODELS.find((m) => activeModelId.includes(m.id.split('-')[1]))
  const activeModelLabel = activeModelEntry?.short || activeModelId

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentStage])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming || !currentProject) return
    setInput('')
    sendPrompt(text, {
      model: selectedModel || undefined,
      skipValidation: mode === 'fast',
      skipRefinement: mode === 'fast'
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-1 p-3">
          {messages.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-xs text-r-text-dim">
                describe what you want to create
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-8 bg-r-accent/10 text-r-text'
                  : 'mr-4 text-r-text-secondary'
              }`}
            >
              <div className="mb-1 text-2xs font-medium text-r-text-dim">
                {msg.role === 'user' ? 'you' : 'rendr'}
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.pipelineStages && (
                <PipelineProgress completedStages={msg.pipelineStages} currentStage={null} />
              )}
            </div>
          ))}
          {isStreaming && <PipelineProgress completedStages={[]} currentStage={currentStage} />}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-r-border/30 p-3">
        <div className="overflow-hidden rounded-xl border border-r-border bg-r-input-bg transition-all focus-within:border-r-accent/40">
          <div className="flex items-end gap-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="describe your model..."
              disabled={!currentProject || isStreaming}
              rows={1}
              className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-3 py-2.5 text-xs text-r-text placeholder:text-r-text-dim focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !currentProject}
              className="mb-1.5 mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-r-accent text-r-bg transition-all hover:bg-r-accent-hover disabled:opacity-20"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1 border-t border-r-border/30 px-2 py-1">
            {/* Mode selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-6 items-center gap-1 rounded-md px-2 text-2xs text-r-text-dim transition-colors hover:bg-r-elevated hover:text-r-text-muted">
                  {mode === 'fast' ? (
                    <Zap className="h-3 w-3 text-r-warning" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-r-accent" />
                  )}
                  {mode === 'fast' ? 'fast' : 'normal'}
                  <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="mb-1 min-w-[160px]">
                <DropdownMenuItem onClick={() => setMode('normal')} className="gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-r-accent" />
                  <div>
                    <div className="text-xs">normal</div>
                    <div className="text-2xs text-r-text-dim">full pipeline</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode('fast')} className="gap-2">
                  <Zap className="h-3.5 w-3.5 text-r-warning" />
                  <div>
                    <div className="text-xs">fast</div>
                    <div className="text-2xs text-r-text-dim">skip validation</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-6 items-center gap-1 rounded-md px-2 text-2xs text-r-text-dim transition-colors hover:bg-r-elevated hover:text-r-text-muted">
                  {selectedModel === null ? 'auto' : activeModelLabel.toLowerCase()}
                  <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-1 min-w-[180px]">
                <DropdownMenuItem onClick={() => setSelectedModel(null)}>
                  <div>
                    <div className="text-xs">auto</div>
                    <div className="text-2xs text-r-text-dim">server default</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                  >
                    <div>
                      <div className="text-xs">{m.label.toLowerCase()}</div>
                      <div className="font-mono text-2xs text-r-text-dim">{m.id}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

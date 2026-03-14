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
import { Send, Loader2, ChevronDown, Zap, Sparkles } from 'lucide-react'
import type { PipelineStage } from '@/types'

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'analyze', label: 'Analyze' },
  { key: 'plan', label: 'Plan' },
  { key: 'generate', label: 'Generate' },
  { key: 'validate', label: 'Validate' },
  { key: 'review', label: 'Review' },
  { key: 'complete', label: 'Done' }
]

const MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', short: 'Sonnet 4' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', short: 'Haiku 4.5' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', short: 'Opus 4' }
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
    <div className="flex items-center gap-1.5 py-1">
      {STAGES.map(({ key, label }) => {
        const isDone =
          completedStages?.includes(key) ||
          (key === 'complete' && !currentStage && completedStages && completedStages.length > 0)
        const isActive = currentStage === key
        return (
          <div key={key} className="flex items-center gap-0.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                isDone
                  ? 'bg-vsc-green'
                  : isActive
                    ? 'bg-vsc-blue animate-pulse-dot'
                    : 'bg-vsc-text-dimmer/30'
              }`}
            />
            <span
              className={`text-2xs ${
                isDone ? 'text-vsc-green' : isActive ? 'text-vsc-blue' : 'text-vsc-text-dimmer/50'
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
  const { currentProject } = useProject()
  const { sendPrompt } = useEditStream()
  const health = useBackendHealth()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('normal')
  const [selectedModel, setSelectedModel] = useState<string | null>(null) // null = auto (use server default)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Resolve which model label to show
  const activeModelId = selectedModel || health.data?.model || MODELS[0].id
  const activeModelEntry = MODELS.find((m) => m.id === activeModelId) ||
    MODELS.find((m) => activeModelId.includes(m.id.split('-')[1])) // fuzzy match
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
        <div ref={scrollRef} className="flex flex-col gap-2 p-3">
          {messages.length === 0 && (
            <div className="py-8 text-center text-[13px] text-vsc-text-dimmer">
              {currentProject ? 'Describe what you want to create' : 'Select a project first'}
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded px-3 py-2 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-vsc-list-active text-vsc-text-bright'
                  : 'text-vsc-text'
              }`}
            >
              <div className="mb-0.5 text-2xs font-medium text-vsc-text-dim">
                {msg.role === 'user' ? 'You' : 'rendr'}
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
      <div className="border-t border-vsc-border p-2">
        <div className="rounded border border-vsc-input-border bg-vsc-input-bg">
          {/* Textarea + send */}
          <div className="flex items-end gap-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentProject ? 'Describe your 3D model...' : 'Select a project first'}
              disabled={!currentProject || isStreaming}
              rows={1}
              className="max-h-24 min-h-[32px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-vsc-text placeholder:text-vsc-text-dimmer focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !currentProject}
              className="mb-1 mr-1 flex h-6 w-6 items-center justify-center rounded text-vsc-text-dim transition-colors hover:text-vsc-text-bright disabled:opacity-30"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Mode + Model selectors - below input, inside the box */}
          <div className="flex items-center gap-1 border-t border-vsc-border/50 px-1 py-1">
            {/* Mode selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-[22px] items-center gap-1 rounded-sm px-1.5 text-[11px] text-vsc-text-dim transition-colors hover:bg-vsc-list-hover hover:text-vsc-text">
                  {mode === 'fast' ? (
                    <Zap className="h-3 w-3 text-vsc-orange" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-vsc-blue" />
                  )}
                  {mode === 'fast' ? 'Fast' : 'Normal'}
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="mb-1 min-w-[160px]">
                <DropdownMenuItem onClick={() => setMode('normal')} className="gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-vsc-blue" />
                  <div>
                    <div className="text-[12px]">Normal</div>
                    <div className="text-2xs text-vsc-text-dimmer">Full pipeline with validation</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode('fast')} className="gap-2">
                  <Zap className="h-3.5 w-3.5 text-vsc-orange" />
                  <div>
                    <div className="text-[12px]">Fast</div>
                    <div className="text-2xs text-vsc-text-dimmer">Skip validation & refinement</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-[22px] items-center gap-1 rounded-sm px-1.5 text-[11px] text-vsc-text-dim transition-colors hover:bg-vsc-list-hover hover:text-vsc-text">
                  {selectedModel === null ? 'Auto' : activeModelLabel}
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-1 min-w-[200px]">
                <DropdownMenuItem
                  onClick={() => setSelectedModel(null)}
                  className="gap-2"
                >
                  <div>
                    <div className="text-[12px]">Auto</div>
                    <div className="text-2xs text-vsc-text-dimmer">Use server default ({health.data?.model || 'claude-sonnet'})</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className="gap-2"
                  >
                    <div>
                      <div className="text-[12px]">{m.label}</div>
                      <div className="font-mono text-2xs text-vsc-text-dimmer">{m.id}</div>
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

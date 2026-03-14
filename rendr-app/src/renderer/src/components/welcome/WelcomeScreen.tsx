import { useState, useRef, useEffect } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { useChat } from '@/contexts/ChatContext'
import { ArrowRight, Plus, Trash2, Clock, Box, Pen } from 'lucide-react'
import { CubeLogo } from '@/components/icons/CubeLogo'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { WindowControls } from '@/components/layout/WindowControls'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const SUGGESTIONS = [
  'a threaded bolt and nut set',
  'a phone stand with cable routing',
  'a desk organizer with pen holders',
  'a parametric gear system',
  'a miniature chess piece',
  'a wall-mounted plant holder'
]

function InlineRename({
  projectId,
  currentName,
  onDone
}: {
  projectId: string
  currentName: string
  onDone: () => void
}) {
  const { renameProject } = useProject()
  const [value, setValue] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== currentName) {
      renameProject(projectId, trimmed)
    }
    onDone()
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') onDone()
      }}
      className="w-full truncate rounded border border-r-text-dim bg-r-bg px-2 py-0.5 text-sm text-r-text outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function WelcomeScreen() {
  const { projects, createProject, setCurrentProject, deleteProject, loading, setInitialPrompt } = useProject()
  const { loadMessages, clearMessages } = useChat()
  const [prompt, setPrompt] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const handleCreate = () => {
    const text = prompt.trim()
    if (!text || isCreating) return
    setIsCreating(true)
    setInitialPrompt(text)
    const project = createProject(text.slice(0, 50))
    loadMessages(project.id)
    setIsCreating(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  const handleSelectProject = (project: typeof projects[0]) => {
    setCurrentProject(project)
    loadMessages(project.id)
  }

  const handleNewBlank = () => {
    createProject()
    clearMessages()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-r-bg">
      {/* Grid background */}
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

      {/* Title bar */}
      <div
        className="relative z-10 flex h-10 w-full shrink-0 items-center justify-between px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <CubeLogo className="h-5 w-5 text-r-text" />
          <span className="text-xs font-medium text-r-text-muted">rendr</span>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <WindowControls />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-8 pt-8 pb-4">
        <div className="w-full max-w-3xl animate-fade-in">
          {/* Greeting */}
          <div className="mb-10 text-center">
            <h1 className="mb-2 text-3xl font-light tracking-tight text-r-text">
              {getGreeting()}
            </h1>
            <p className="text-sm text-r-text-muted">
              what would you like to create?
            </p>
          </div>

          {/* Big prompt input */}
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="rounded-2xl border border-r-border bg-r-surface/80 p-1.5 backdrop-blur-sm transition-all focus-within:border-r-text-dim focus-within:shadow-[0_0_30px_rgba(255,255,255,0.03)]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="describe a 3d model..."
                rows={3}
                className="min-h-[80px] w-full resize-none bg-transparent px-5 py-4 text-base leading-relaxed text-r-text placeholder:text-r-text-dim focus:outline-none"
                autoFocus
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      className="rounded-md border border-r-border px-2 py-0.5 text-2xs text-r-text-dim transition-all hover:border-r-text-dim hover:text-r-text-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!prompt.trim() || isCreating}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-r-text text-r-bg transition-all hover:bg-r-accent-hover disabled:opacity-20"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Projects as cards with previews */}
          {!loading && projects.length > 0 && (
            <div className="animate-slide-up">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-r-text-dim">
                  recent projects
                </span>
                <button
                  onClick={handleNewBlank}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-r-text-muted transition-colors hover:bg-r-elevated hover:text-r-text-secondary"
                >
                  <Plus className="h-3 w-3" />
                  blank project
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {projects.slice(0, 6).map((project) => (
                  <ContextMenu key={project.id}>
                    <ContextMenuTrigger>
                      <button
                        onClick={() => renamingId === project.id ? undefined : handleSelectProject(project)}
                        className="group flex h-44 w-full flex-col overflow-hidden rounded-xl border border-r-border bg-r-surface/60 text-left transition-all hover:border-r-border-light hover:bg-r-surface"
                      >
                        {/* Preview area — fixed height */}
                        <div className="flex h-32 w-full items-center justify-center overflow-hidden border-b border-r-border bg-r-bg/50">
                          {project.previewImage ? (
                            <img
                              src={`data:image/png;base64,${project.previewImage}`}
                              alt={project.name}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : project.code ? (
                            <pre className="h-full w-full overflow-hidden px-3 py-2 text-2xs leading-tight text-r-text-dim">
                              {project.code.split('\n').slice(0, 8).join('\n')}
                            </pre>
                          ) : (
                            <Box className="h-6 w-6 text-r-text-dim/30" strokeWidth={1} />
                          )}
                        </div>

                        {/* Info — fixed bottom section */}
                        <div className="flex min-h-0 flex-1 flex-col justify-center px-3">
                          {renamingId === project.id ? (
                            <InlineRename
                              projectId={project.id}
                              currentName={project.name}
                              onDone={() => setRenamingId(null)}
                            />
                          ) : (
                            <div className="truncate text-xs text-r-text-secondary transition-colors group-hover:text-r-text">
                              {project.name}
                            </div>
                          )}
                          <div className="mt-0.5 flex items-center gap-1 text-2xs text-r-text-dim">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDate(project.updatedAt)}
                          </div>
                        </div>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => setRenamingId(project.id)}>
                        <Pen className="mr-2 h-3 w-3" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-r-error focus:text-r-error"
                        onClick={() => deleteProject(project.id)}
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-r-border border-t-r-text" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex h-8 shrink-0 items-center justify-center text-2xs text-r-text-dim">
        rendr
      </div>
    </div>
  )
}

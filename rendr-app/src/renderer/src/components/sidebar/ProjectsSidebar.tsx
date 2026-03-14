import { useProject } from '@/contexts/ProjectContext'
import { useChat } from '@/contexts/ChatContext'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { ChevronRight, ChevronDown, FileCode2 } from 'lucide-react'
import { useState } from 'react'

export function ProjectsSidebar() {
  const { projects, currentProject, setCurrentProject, createProject, deleteProject, renameProject, duplicateProject } =
    useProject()
  const { clearMessages, loadMessages } = useChat()
  const [isExpanded, setIsExpanded] = useState(true)

  const handleSelect = (project: typeof projects[0]) => {
    setCurrentProject(project)
    loadMessages(project.id)
  }

  const handleNew = () => {
    const p = createProject()
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
    <div className="flex h-full flex-col bg-vsc-sidebar">
      {/* Section header - VS Code style */}
      <div className="flex h-[35px] items-center px-5 text-[11px] font-semibold uppercase tracking-wide text-vsc-text-dim">
        Explorer
      </div>

      <ScrollArea className="flex-1">
        {/* Collapsible tree header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex h-[22px] w-full items-center gap-0.5 bg-vsc-sidebar px-2 text-[11px] font-bold uppercase tracking-wide text-vsc-text-bright hover:bg-vsc-list-hover"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          Projects
        </button>

        {isExpanded && (
          <div>
            {projects.length === 0 && (
              <div className="px-8 py-4 text-[11px] text-vsc-text-dimmer">
                No projects yet.{' '}
                <button onClick={handleNew} className="text-vsc-blue hover:underline">
                  Create one
                </button>
              </div>
            )}
            {projects.map((project) => (
              <ContextMenu key={project.id}>
                <ContextMenuTrigger>
                  <button
                    onClick={() => handleSelect(project)}
                    className={`flex h-[22px] w-full items-center gap-1 pl-6 pr-2 text-[13px] transition-colors ${
                      currentProject?.id === project.id
                        ? 'bg-vsc-list-active text-vsc-text-bright'
                        : 'text-vsc-text hover:bg-vsc-list-hover'
                    }`}
                  >
                    <FileCode2 className="h-[14px] w-[14px] shrink-0 text-vsc-orange" />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto text-2xs text-vsc-text-dimmer">{formatDate(project.updatedAt)}</span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      const name = prompt('Rename project:', project.name)
                      if (name) renameProject(project.id, name)
                    }}
                  >
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => duplicateProject(project.id)}>
                    Duplicate
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-vsc-red focus:text-vsc-red"
                    onClick={() => deleteProject(project.id)}
                  >
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}

            {/* New project item */}
            <button
              onClick={handleNew}
              className="flex h-[22px] w-full items-center gap-1 pl-6 pr-2 text-[13px] text-vsc-text-dim hover:bg-vsc-list-hover"
            >
              <span className="text-vsc-text-dimmer">+ New Project</span>
            </button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

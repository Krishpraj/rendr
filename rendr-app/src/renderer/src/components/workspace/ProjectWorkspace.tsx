import { useState, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useProject } from '@/contexts/ProjectContext'
import { useChat } from '@/contexts/ChatContext'
import { MeshAnalyticsProvider } from '@/contexts/MeshAnalyticsContext'
import { ArrowLeft, Box } from 'lucide-react'
import { WindowControls } from '@/components/layout/WindowControls'
import { StatusBar } from '@/components/layout/StatusBar'
import { ViewerPanel } from './ViewerPanel'
import { Sidebar } from './Sidebar'

export function ProjectWorkspace() {
  const { currentProject, setCurrentProject } = useProject()
  const { clearMessages } = useChat()
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'code' | 'params' | 'analysis' | 'layers'>('chat')

  const handleBack = useCallback(() => {
    setCurrentProject(null)
    clearMessages()
  }, [setCurrentProject, clearMessages])


  return (
    <MeshAnalyticsProvider>
    <div className="flex h-full w-full flex-col bg-r-bg">
      {/* Top bar */}
      <div
        className="flex h-10 shrink-0 items-center justify-between border-b border-r-border/30 px-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: back + project name */}
        <div
          className="flex min-w-0 items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleBack}
            className="flex h-7 w-7 items-center justify-center rounded-md text-r-text-muted transition-colors hover:bg-r-elevated hover:text-r-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Box className="h-3 w-3 text-r-accent" />
            <span className="truncate text-xs text-r-text-secondary">
              {currentProject?.name}
            </span>
          </div>
        </div>

        {/* Right: window controls */}
        <div
          className="flex shrink-0 items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <WindowControls />
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="rendr-workspace">
          <Panel defaultSize={60} minSize={35} id="viewer-panel" order={0}>
            <ViewerPanel />
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          <Panel defaultSize={40} minSize={25} maxSize={55} id="sidebar-panel" order={1}>
            <Sidebar activeTab={sidebarTab} onTabChange={setSidebarTab} />
          </Panel>
        </PanelGroup>
      </div>
      {/* Status bar */}
      <StatusBar />
    </div>
    </MeshAnalyticsProvider>
  )
}

import { useState, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useProject } from '@/contexts/ProjectContext'
import { useChat } from '@/contexts/ChatContext'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { MeshAnalyticsProvider } from '@/contexts/MeshAnalyticsContext'
import { ArrowLeft, Download, FileDown, Box } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { WindowControls } from '@/components/layout/WindowControls'
import { ViewerPanel } from './ViewerPanel'
import { Sidebar } from './Sidebar'

export function ProjectWorkspace() {
  const { currentProject, setCurrentProject } = useProject()
  const { clearMessages } = useChat()
  const health = useBackendHealth()
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'code' | 'params' | 'analysis' | 'layers'>('chat')

  const isConnected = health.isSuccess

  const handleBack = useCallback(() => {
    setCurrentProject(null)
    clearMessages()
  }, [setCurrentProject, clearMessages])

  const handleExport = async (format: 'scad' | 'stl') => {
    if (!currentProject?.code) {
      toast.error('No code to export')
      return
    }
    try {
      if (format === 'scad') {
        const base64 = btoa(currentProject.code)
        await window.api.exportFile(base64, `${currentProject.name}.scad`, [
          { name: 'OpenSCAD', extensions: ['scad'] }
        ])
        toast.success('Exported .scad file')
      } else if (format === 'stl') {
        toast.info('Use the download button in the 3D viewer')
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

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
          className="flex items-center gap-2"
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

        {/* Center: status */}
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-r-success' : 'bg-r-error'}`} />
          <span className="text-2xs text-r-text-dim">{isConnected ? 'connected' : 'offline'}</span>
          {isConnected && health.data?.model && (
            <>
              <span className="text-2xs text-r-text-dim">·</span>
              <span className="text-2xs text-r-text-dim">{health.data.model}</span>
            </>
          )}
        </div>

        {/* Right: export + window controls */}
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 items-center gap-1.5 rounded-md px-2 text-2xs text-r-text-muted transition-colors hover:bg-r-elevated hover:text-r-text-secondary">
                <Download className="h-3 w-3" />
                export
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('scad')}>
                <FileDown className="mr-2 h-3.5 w-3.5" />
                OpenSCAD (.scad)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
    </div>
    </MeshAnalyticsProvider>
  )
}

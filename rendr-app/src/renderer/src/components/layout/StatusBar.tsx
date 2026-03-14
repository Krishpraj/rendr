import { useBackendHealth } from '@/hooks/useBackendHealth'
import { useProject } from '@/contexts/ProjectContext'
import { useChat } from '@/contexts/ChatContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Download, FileDown, AlertCircle, CheckCircle2, Cpu, GitBranch } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function StatusBar() {
  const health = useBackendHealth()
  const { currentProject } = useProject()
  const { isStreaming, currentStage } = useChat()

  const isConnected = health.isSuccess
  const modelName = health.data?.model || 'claude-sonnet'
  const provider = health.data?.provider || 'anthropic'

  const handleExport = async (format: 'scad' | 'png') => {
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
      } else if (format === 'png') {
        const result = await api.render({ code: currentProject.code })
        await window.api.exportFile(result.image, `${currentProject.name}.png`, [
          { name: 'PNG Image', extensions: ['png'] }
        ])
        toast.success('Exported .png file')
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="flex h-[22px] items-center bg-vsc-statusbar text-[11px] text-vsc-statusbar-text">
      {/* Left side */}
      <div className="flex h-full items-center">
        {/* Connection status */}
        <button className="flex h-full items-center gap-1 px-2 hover:bg-vsc-statusbar-hover transition-colors">
          {isConnected ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          <span>{isConnected ? 'Connected' : 'Offline'}</span>
        </button>

        {/* Branch / project indicator */}
        {currentProject && (
          <button className="flex h-full items-center gap-1 px-2 hover:bg-vsc-statusbar-hover transition-colors">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">{currentProject.name}</span>
          </button>
        )}

        {/* Pipeline status when streaming */}
        {isStreaming && currentStage && (
          <div className="flex h-full items-center gap-1 px-2">
            <div className="h-2 w-2 animate-spin rounded-sm border border-vsc-statusbar-text border-t-transparent" />
            <span>{currentStage}...</span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex h-full items-center">
        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-full items-center gap-1 px-2 hover:bg-vsc-statusbar-hover transition-colors">
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-1">
            <DropdownMenuItem onClick={() => handleExport('scad')}>
              <FileDown className="mr-2 h-3.5 w-3.5" />
              OpenSCAD (.scad)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('png')}>
              <FileDown className="mr-2 h-3.5 w-3.5" />
              Render PNG (.png)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* OpenSCAD status */}
        <button className="flex h-full items-center gap-1 px-2 hover:bg-vsc-statusbar-hover transition-colors">
          <span>OpenSCAD: WASM</span>
        </button>

        {/* Model selector */}
        <button className="flex h-full items-center gap-1 px-2 hover:bg-vsc-statusbar-hover transition-colors">
          <Cpu className="h-3.5 w-3.5" />
          <span>{modelName}</span>
        </button>

        {/* Provider */}
        <button className="flex h-full items-center px-2 hover:bg-vsc-statusbar-hover transition-colors">
          <span>{provider}</span>
        </button>
      </div>
    </div>
  )
}

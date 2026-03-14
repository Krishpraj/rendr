import { useState, useEffect, useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { useRender } from '@/hooks/useRender'
import { Loader2, Box, Image, Code2, Rotate3D } from 'lucide-react'
import { StlViewer } from './StlViewer'
import { CodeEditor } from './CodeEditor'

type ViewMode = 'preview' | '3d' | 'code'

export function PreviewPanel() {
  const { currentProject, updateProjectCode } = useProject()
  const render = useRender()
  const [viewMode, setViewMode] = useState<ViewMode>('3d')

  useEffect(() => {
    if (currentProject?.code && !currentProject.previewImage) {
      render.mutate(
        { code: currentProject.code },
        {
          onSuccess: (data) => {
            updateProjectCode(currentProject.code, currentProject.parameters, data.image)
          }
        }
      )
    }
  }, [currentProject?.code])

  // Called by the code editor on every debounced change — saves to DB and refreshes 3D
  const handleCodeChange = useCallback(
    (newCode: string) => {
      if (!currentProject) return
      updateProjectCode(newCode, currentProject.parameters)
    },
    [currentProject, updateProjectCode]
  )

  if (!currentProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-vsc-editor">
        <Box className="mb-3 h-12 w-12 text-vsc-text-dimmer" strokeWidth={1} />
        <p className="text-[13px] text-vsc-text-dim">Select or create a project to begin</p>
      </div>
    )
  }

  if (!currentProject.code) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-vsc-editor">
        <Box className="mb-3 h-12 w-12 text-vsc-text-dimmer" strokeWidth={1} />
        <p className="text-[13px] text-vsc-text-dim">Enter a prompt to generate a 3D model</p>
        <p className="mt-1 text-[11px] text-vsc-text-dimmer">Use the chat panel on the right</p>
      </div>
    )
  }

  const tabs: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: '3d', icon: <Rotate3D className="h-3.5 w-3.5" />, label: '3D View' },
    { mode: 'preview', icon: <Image className="h-3.5 w-3.5" />, label: 'Preview' },
    { mode: 'code', icon: <Code2 className="h-3.5 w-3.5" />, label: 'Code' }
  ]

  return (
    <div className="flex h-full flex-col bg-vsc-editor">
      {/* Tab bar */}
      <div className="flex items-center border-b border-vsc-border bg-vsc-sidebar px-2">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => setViewMode(tab.mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-b-2 transition-colors ${
              viewMode === tab.mode
                ? 'border-vsc-blue text-vsc-text'
                : 'border-transparent text-vsc-text-dim hover:text-vsc-text'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' ? (
          <CodeEditor code={currentProject.code} onChange={handleCodeChange} />
        ) : viewMode === '3d' ? (
          <StlViewer code={currentProject.code} />
        ) : render.isPending ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-vsc-blue" />
            <p className="text-[13px] text-vsc-text-dim">Rendering...</p>
          </div>
        ) : currentProject.previewImage ? (
          <div className="flex h-full items-center justify-center p-4">
            <img
              src={`data:image/png;base64,${currentProject.previewImage}`}
              alt="3D Preview"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Box className="h-10 w-10 text-vsc-text-dimmer" strokeWidth={1} />
            <p className="text-[13px] text-vsc-text-dim">Preview unavailable</p>
            <p className="text-[11px] text-vsc-text-dimmer">OpenSCAD not installed — switch to Code tab to see output</p>
            <button
              onClick={() => setViewMode('code')}
              className="mt-1 rounded border border-vsc-border px-3 py-1 text-[12px] text-vsc-blue hover:bg-vsc-sidebar transition-colors"
            >
              View Code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

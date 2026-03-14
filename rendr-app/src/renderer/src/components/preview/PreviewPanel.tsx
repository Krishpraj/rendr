import { useState, useEffect } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { useRender } from '@/hooks/useRender'
import { Loader2, Box, Image, Code2, Copy, Check } from 'lucide-react'

type ViewMode = 'preview' | 'code'

export function PreviewPanel() {
  const { currentProject, updateProjectCode } = useProject()
  const render = useRender()
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [copied, setCopied] = useState(false)

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

  const copyCode = async () => {
    if (!currentProject?.code) return
    await navigator.clipboard.writeText(currentProject.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  return (
    <div className="flex h-full flex-col bg-vsc-editor">
      {/* Tab bar */}
      <div className="flex items-center border-b border-vsc-border bg-vsc-sidebar px-2">
        <button
          onClick={() => setViewMode('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-b-2 transition-colors ${
            viewMode === 'preview'
              ? 'border-vsc-blue text-vsc-text'
              : 'border-transparent text-vsc-text-dim hover:text-vsc-text'
          }`}
        >
          <Image className="h-3.5 w-3.5" />
          Preview
        </button>
        <button
          onClick={() => setViewMode('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-b-2 transition-colors ${
            viewMode === 'code'
              ? 'border-vsc-blue text-vsc-text'
              : 'border-transparent text-vsc-text-dim hover:text-vsc-text'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' ? (
          <div className="relative h-full">
            <button
              onClick={copyCode}
              className="absolute right-3 top-3 z-10 rounded border border-vsc-border bg-vsc-sidebar p-1.5 text-vsc-text-dim hover:text-vsc-text transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <pre className="h-full overflow-auto p-4 text-[13px] leading-relaxed text-vsc-text font-mono">
              <code>{currentProject.code}</code>
            </pre>
          </div>
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

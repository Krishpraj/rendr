import { useProject } from '@/contexts/ProjectContext'
import { Box, Loader2 } from 'lucide-react'
import { StlViewer } from '@/components/preview/StlViewer'

export function ViewerPanel() {
  const { currentProject } = useProject()

  if (!currentProject?.code) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-r-bg">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-r-surface">
          <Box className="h-7 w-7 text-r-text-dim" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm text-r-text-muted">
          describe your model in the chat
        </p>
        <p className="mt-1 text-xs text-r-text-dim">
          the 3d preview will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <StlViewer code={currentProject.code} />
    </div>
  )
}

import { useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { CodeEditor } from '@/components/preview/CodeEditor'

export function CodePanel() {
  const { currentProject, updateProjectCode } = useProject()

  const handleCodeChange = useCallback(
    (newCode: string) => {
      if (!currentProject) return
      updateProjectCode(newCode, currentProject.parameters)
    },
    [currentProject, updateProjectCode]
  )

  if (!currentProject?.code) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-r-text-dim">no code yet</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden">
      <CodeEditor code={currentProject.code} onChange={handleCodeChange} />
    </div>
  )
}

import { useProject } from '@/contexts/ProjectContext'

export function TitleBar() {
  const { currentProject } = useProject()

  return (
    <div
      className="flex h-[30px] items-center justify-center bg-vsc-titlebar text-2xs text-vsc-text-dim"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {currentProject ? `${currentProject.name} - rendr` : 'rendr'}
    </div>
  )
}

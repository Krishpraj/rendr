import { useProject } from '@/contexts/ProjectContext'
import { CubeLogo } from '@/components/icons/CubeLogo'

export function TitleBar() {
  const { currentProject } = useProject()

  return (
    <div
      className="flex h-[30px] items-center justify-center gap-2 bg-vsc-titlebar text-2xs text-vsc-text-dim"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <CubeLogo className="h-3.5 w-3.5" />
      {currentProject ? `${currentProject.name} - rendr` : 'rendr'}
    </div>
  )
}

import { useProject } from '@/contexts/ProjectContext'
import { WelcomeScreen } from '@/components/welcome/WelcomeScreen'
import { ProjectWorkspace } from '@/components/workspace/ProjectWorkspace'

export function AppShell() {
  const { currentProject } = useProject()

  if (!currentProject) {
    return <WelcomeScreen />
  }

  return <ProjectWorkspace />
}

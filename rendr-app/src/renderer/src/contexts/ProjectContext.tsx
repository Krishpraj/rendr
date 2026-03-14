import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { v4 as uuid } from 'uuid'
import type { Project, Parameter } from '@/types'

interface ProjectContextValue {
  projects: Project[]
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void
  createProject: (name?: string) => Project
  saveProject: (project: Project) => void
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  duplicateProject: (id: string) => Project
  updateProjectCode: (code: string, parameters?: Parameter[], previewImage?: string | null) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

const STORAGE_KEY = 'rendr-projects'

function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function persistProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

  useEffect(() => {
    persistProjects(projects)
  }, [projects])

  const createProject = useCallback((name?: string) => {
    const project: Project = {
      id: uuid(),
      name: name || 'Untitled Project',
      code: '',
      parameters: [],
      previewImage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setProjects((prev) => [project, ...prev])
    setCurrentProject(project)
    return project
  }, [])

  const saveProject = useCallback((project: Project) => {
    const updated = { ...project, updatedAt: new Date().toISOString() }
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setCurrentProject((curr) => (curr?.id === updated.id ? updated : curr))
  }, [])

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (currentProject?.id === id) setCurrentProject(null)
    },
    [currentProject]
  )

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p))
    )
    setCurrentProject((curr) => (curr?.id === id ? { ...curr, name } : curr))
  }, [])

  const duplicateProject = useCallback(
    (id: string) => {
      const original = projects.find((p) => p.id === id)
      if (!original) throw new Error('Project not found')
      const dup: Project = {
        ...original,
        id: uuid(),
        name: `${original.name} (copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setProjects((prev) => [dup, ...prev])
      setCurrentProject(dup)
      return dup
    },
    [projects]
  )

  const updateProjectCode = useCallback(
    (code: string, parameters?: Parameter[], previewImage?: string | null) => {
      setCurrentProject((curr) => {
        if (!curr) return curr
        const updated = {
          ...curr,
          code,
          parameters: parameters ?? curr.parameters,
          previewImage: previewImage !== undefined ? previewImage : curr.previewImage,
          updatedAt: new Date().toISOString()
        }
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        return updated
      })
    },
    []
  )

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        setCurrentProject,
        createProject,
        saveProject,
        deleteProject,
        renameProject,
        duplicateProject,
        updateProjectCode
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}

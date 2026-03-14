import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { v4 as uuid } from 'uuid'
import type { Project, Parameter } from '@/types'
import { api } from '@/lib/api'

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
  loading: boolean
  initialPrompt: string | null
  setInitialPrompt: (prompt: string | null) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null)

  // Load projects from backend on mount
  useEffect(() => {
    api
      .listProjects()
      .then((data) => {
        setProjects(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load projects from backend:', err)
        setLoading(false)
      })
  }, [])

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
    api.createProject(project).catch((err) => console.error('Failed to save project:', err))
    return project
  }, [])

  const saveProject = useCallback((project: Project) => {
    const updated = { ...project, updatedAt: new Date().toISOString() }
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setCurrentProject((curr) => (curr?.id === updated.id ? updated : curr))
    api
      .updateProject(updated.id, {
        name: updated.name,
        code: updated.code,
        parameters: updated.parameters,
        previewImage: updated.previewImage,
        updatedAt: updated.updatedAt
      })
      .catch((err) => console.error('Failed to update project:', err))
  }, [])

  const deleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id))
      if (currentProject?.id === id) setCurrentProject(null)
      api.deleteProject(id).catch((err) => console.error('Failed to delete project:', err))
    },
    [currentProject]
  )

  const renameProject = useCallback((id: string, name: string) => {
    const now = new Date().toISOString()
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name, updatedAt: now } : p))
    )
    setCurrentProject((curr) => (curr?.id === id ? { ...curr, name } : curr))
    api.updateProject(id, { name, updatedAt: now }).catch((err) => console.error('Failed to rename project:', err))
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
      api.createProject(dup).catch((err) => console.error('Failed to save duplicated project:', err))
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
        api
          .updateProject(updated.id, {
            code: updated.code,
            parameters: updated.parameters,
            previewImage: updated.previewImage,
            updatedAt: updated.updatedAt
          })
          .catch((err) => console.error('Failed to update project code:', err))
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
        updateProjectCode,
        loading,
        initialPrompt,
        setInitialPrompt
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

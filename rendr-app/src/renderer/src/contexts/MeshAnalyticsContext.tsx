import { createContext, useContext, useState, type ReactNode } from 'react'
import type { MeshAnalytics } from '@/lib/meshAnalytics'

interface MeshAnalyticsContextValue {
  analytics: MeshAnalytics | null
  stlSize: number | null
  setAnalytics: (a: MeshAnalytics | null) => void
  setStlSize: (s: number | null) => void
}

const MeshAnalyticsContext = createContext<MeshAnalyticsContextValue | null>(null)

export function MeshAnalyticsProvider({ children }: { children: ReactNode }) {
  const [analytics, setAnalytics] = useState<MeshAnalytics | null>(null)
  const [stlSize, setStlSize] = useState<number | null>(null)

  return (
    <MeshAnalyticsContext.Provider value={{ analytics, stlSize, setAnalytics, setStlSize }}>
      {children}
    </MeshAnalyticsContext.Provider>
  )
}

export function useMeshAnalytics() {
  const ctx = useContext(MeshAnalyticsContext)
  if (!ctx) throw new Error('useMeshAnalytics must be used within MeshAnalyticsProvider')
  return ctx
}

import { createContext, useContext, useState, useRef, type ReactNode } from 'react'
import type { MeshAnalytics } from '@/lib/meshAnalytics'
import * as THREE from 'three'

interface MeshAnalyticsContextValue {
  analytics: MeshAnalytics | null
  stlSize: number | null
  geometry: THREE.BufferGeometry | null
  setAnalytics: (a: MeshAnalytics | null) => void
  setStlSize: (s: number | null) => void
  setGeometry: (g: THREE.BufferGeometry | null) => void
}

const MeshAnalyticsContext = createContext<MeshAnalyticsContextValue | null>(null)

export function MeshAnalyticsProvider({ children }: { children: ReactNode }) {
  const [analytics, setAnalytics] = useState<MeshAnalytics | null>(null)
  const [stlSize, setStlSize] = useState<number | null>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  return (
    <MeshAnalyticsContext.Provider value={{ analytics, stlSize, geometry, setAnalytics, setStlSize, setGeometry }}>
      {children}
    </MeshAnalyticsContext.Provider>
  )
}

export function useMeshAnalytics() {
  const ctx = useContext(MeshAnalyticsContext)
  if (!ctx) throw new Error('useMeshAnalytics must be used within MeshAnalyticsProvider')
  return ctx
}

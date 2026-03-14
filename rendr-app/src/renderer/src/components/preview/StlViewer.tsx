import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Center,
  GizmoHelper,
  GizmoViewcube,
  Stage,
  OrthographicCamera,
  PerspectiveCamera
} from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { AlertCircle, Download, Eye, Grid3X3, ChevronDown, ChevronUp } from 'lucide-react'
import { scadToStl } from '@/lib/openscad'
import { cn } from '@/lib/utils'
import { analyzeMesh, formatNumber, formatSize, type MeshAnalytics } from '@/lib/meshAnalytics'
import { useMeshAnalytics } from '@/contexts/MeshAnalyticsContext'

interface StlViewerProps {
  code: string
}

const DEFAULT_BRIGHTNESS = 50
const DEFAULT_ROUGHNESS = 60
const DEFAULT_METALNESS = 15

type ViewMode = 'solid' | 'wireframe'

function StlModel({
  geometry,
  brightness,
  roughness,
  metalness,
  wireframe,
  color
}: {
  geometry: THREE.BufferGeometry
  brightness: number
  roughness: number
  metalness: number
  wireframe: boolean
  color: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => {
    const actualBrightness = brightness / 50
    const actualRoughness = roughness / 100
    const actualMetalness = metalness / 100

    const baseColor = new THREE.Color(color)
    const r = Math.min(1, Math.max(0, baseColor.r * actualBrightness))
    const g = Math.min(1, Math.max(0, baseColor.g * actualBrightness))
    const b = Math.min(1, Math.max(0, baseColor.b * actualBrightness))

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(r, g, b),
      metalness: actualMetalness,
      roughness: actualRoughness,
      flatShading: false,
      wireframe,
      envMapIntensity: 0.3
    })
  }, [brightness, roughness, metalness, wireframe, color])

  useEffect(() => {
    geometry.computeVertexNormals()
  }, [geometry])

  return (
    <Center>
      <mesh ref={meshRef} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
    </Center>
  )
}

const cache: { code: string; geometry: THREE.BufferGeometry } | null = {
  code: '',
  geometry: null as unknown as THREE.BufferGeometry
}

// ── Mesh Info Overlay ──

function MeshInfoPanel({ analytics }: { analytics: MeshAnalytics }) {
  const [expanded, setExpanded] = useState(true)
  const bb = analytics.boundingBox

  return (
    <div className="absolute left-3 bottom-16 w-52 overflow-hidden rounded-lg border border-r-border/50 bg-r-surface/90 shadow-lg backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-1.5"
      >
        <span className="text-2xs font-medium uppercase tracking-widest text-r-text-dim">mesh analysis</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-r-text-dim" /> : <ChevronUp className="h-3 w-3 text-r-text-dim" />}
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-r-border/30 px-3 py-2">
          {/* Geometry */}
          <div>
            <div className="mb-1 text-2xs text-r-text-dim">geometry</div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
              <InfoCell label="verts" value={formatNumber(analytics.vertices)} />
              <InfoCell label="tris" value={formatNumber(analytics.triangles)} />
              <InfoCell label="edges" value={formatNumber(analytics.edges)} />
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <div className="mb-1 text-2xs text-r-text-dim">bounding box</div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
              <InfoCell label="w" value={formatSize(bb.width)} />
              <InfoCell label="h" value={formatSize(bb.height)} />
              <InfoCell label="d" value={formatSize(bb.depth)} />
            </div>
          </div>

          {/* Physical */}
          <div>
            <div className="mb-1 text-2xs text-r-text-dim">physical</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <InfoCell label="area" value={`${formatNumber(analytics.surfaceArea)} mm²`} />
              <InfoCell label="vol" value={`${formatNumber(analytics.volume)} mm³`} />
            </div>
          </div>

          {/* Topology */}
          <div>
            <div className="mb-1 text-2xs text-r-text-dim">topology</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  analytics.isWatertight ? 'bg-r-success' : 'bg-r-warning'
                )} />
                <span className="text-2xs text-r-text-secondary">
                  {analytics.isWatertight ? 'watertight' : 'open mesh'}
                </span>
              </div>
              {analytics.genus > 0 && (
                <span className="text-2xs text-r-text-muted">
                  genus {analytics.genus}
                </span>
              )}
            </div>
          </div>

          {/* Center of mass */}
          <div>
            <div className="mb-1 text-2xs text-r-text-dim">center of mass</div>
            <div className="font-mono text-2xs text-r-text-muted">
              ({analytics.centerOfMass.x}, {analytics.centerOfMass.y}, {analytics.centerOfMass.z})
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-2xs text-r-text-dim">{label} </span>
      <span className="font-mono text-2xs text-r-text-secondary">{value}</span>
    </div>
  )
}

// ── Main Viewer ──

export function StlViewer({ code }: StlViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(
    cache?.code === code ? cache.geometry : null
  )
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Building 3D model...')
  const [error, setError] = useState<string | null>(null)
  const renderingRef = useRef('')

  const [isOrthographic, setIsOrthographic] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('solid')
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS)
  const [roughness, setRoughness] = useState(DEFAULT_ROUGHNESS)
  const [metalness, setMetalness] = useState(DEFAULT_METALNESS)
  const [modelColor] = useState('#818cf8')
  const [meshAnalytics, setMeshAnalytics] = useState<MeshAnalytics | null>(null)
  const meshCtx = useMeshAnalytics()

  const stlBufferRef = useRef<ArrayBuffer | null>(null)

  useEffect(() => {
    if (!code) return

    if (cache?.code === code && cache.geometry) {
      setGeometry(cache.geometry)
      const a = analyzeMesh(cache.geometry)
      setMeshAnalytics(a)
      meshCtx.setAnalytics(a)
      meshCtx.setGeometry(cache.geometry)
      return
    }

    if (renderingRef.current === code) return
    renderingRef.current = code

    setLoading(true)
    setLoadingMessage('Initializing OpenSCAD...')
    setError(null)
    setGeometry(null)
    setMeshAnalytics(null)

    const thisCode = code

    scadToStl(thisCode, (status) => {
      if (renderingRef.current === thisCode) setLoadingMessage(status)
    })
      .then((buffer) => {
        const loader = new STLLoader()
        const geo = loader.parse(buffer)
        geo.center()

        stlBufferRef.current = buffer

        if (renderingRef.current === thisCode) {
          const a = analyzeMesh(geo)
          setGeometry(geo)
          setMeshAnalytics(a)
          meshCtx.setAnalytics(a)
          meshCtx.setGeometry(geo)
          meshCtx.setStlSize(buffer.byteLength)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (renderingRef.current === thisCode) {
          console.error('[StlViewer] Error:', err)
          setError(err.message || 'Failed to compile OpenSCAD code')
          setLoading(false)
        }
      })
  }, [code])

  const handleDownloadStl = useCallback(() => {
    if (!stlBufferRef.current) return
    const blob = new Blob([stlBufferRef.current], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'model.stl'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-r-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-r-border border-t-r-accent" />
        <p className="mt-3 text-xs text-r-text-muted">{loadingMessage}</p>
        <p className="mt-1 text-2xs text-r-text-dim">first load may take a moment</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-r-bg">
        <AlertCircle className="h-6 w-6 text-r-error" />
        <p className="text-xs text-r-text-muted">compilation error</p>
        <p className="max-w-sm text-center text-2xs text-r-text-dim">{error}</p>
      </div>
    )
  }

  if (!geometry) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-r-bg">
        <p className="text-xs text-r-text-dim">no model to display</p>
      </div>
    )
  }

  const isWireframe = viewMode === 'wireframe'

  return (
    <div className="relative h-full w-full">
      <Canvas
        gl={{ antialias: true, powerPreference: 'default', toneMapping: THREE.NoToneMapping }}
        style={{ background: '#0a0a0a' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
          canvas.addEventListener('webglcontextrestored', () => gl.resetState())
        }}
      >
        {isOrthographic ? (
          <OrthographicCamera
            makeDefault
            position={[-100, 100, 100]}
            zoom={3}
            near={0.1}
            far={10000}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={[100, 100, 100]}
            fov={50}
            near={0.1}
            far={10000}
          />
        )}

        {/* <gridHelper args={[200, 40, '#1a1a1a', '#141414']} rotation={[0, 0, 0]} /> */}

        <Stage environment={null} intensity={0.6}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[50, 80, 50]} intensity={1.2} castShadow />
          <directionalLight position={[-30, -20, -50]} intensity={0.3} />
          <directionalLight position={[-30, 50, -30]} intensity={0.2} />
          <directionalLight position={[0, 50, 0]} intensity={0.2} />
          <StlModel
            geometry={geometry}
            brightness={brightness}
            roughness={roughness}
            metalness={metalness}
            wireframe={isWireframe}
            color={modelColor}
          />
        </Stage>

        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewcube />
        </GizmoHelper>
      </Canvas>

      {/* Mesh analytics panel - bottom left */}
      {meshAnalytics && <MeshInfoPanel analytics={meshAnalytics} />}

      {/* Bottom center controls */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-r-border/50 bg-r-surface/90 p-1 backdrop-blur-sm">
          <button
            onClick={() => setViewMode('solid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-medium transition-all',
              viewMode === 'solid'
                ? 'bg-r-accent text-r-bg'
                : 'text-r-text-muted hover:text-r-text-secondary'
            )}
          >
            <Eye className="h-3 w-3" />
            solid
          </button>
          <button
            onClick={() => setViewMode('wireframe')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-medium transition-all',
              viewMode === 'wireframe'
                ? 'bg-r-accent text-r-bg'
                : 'text-r-text-muted hover:text-r-text-secondary'
            )}
          >
            <Grid3X3 className="h-3 w-3" />
            wire
          </button>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-r-border/50 bg-r-surface/90 p-1 backdrop-blur-sm">
          <button
            onClick={() => setIsOrthographic(false)}
            className={cn(
              'rounded-md px-2.5 py-1 text-2xs font-medium transition-all',
              !isOrthographic
                ? 'bg-r-accent text-r-bg'
                : 'text-r-text-muted hover:text-r-text-secondary'
            )}
          >
            persp
          </button>
          <button
            onClick={() => setIsOrthographic(true)}
            className={cn(
              'rounded-md px-2.5 py-1 text-2xs font-medium transition-all',
              isOrthographic
                ? 'bg-r-accent text-r-bg'
                : 'text-r-text-muted hover:text-r-text-secondary'
            )}
          >
            ortho
          </button>
        </div>
      </div>

      {/* Top right download */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {stlBufferRef.current && (
          <button
            onClick={handleDownloadStl}
            className="flex items-center gap-1.5 rounded-md border border-r-border/50 bg-r-surface/90 px-2.5 py-1 text-2xs text-r-text-muted backdrop-blur-sm transition-colors hover:text-r-text"
          >
            <Download className="h-3 w-3" />
            .stl
          </button>
        )}
      </div>
    </div>
  )
}

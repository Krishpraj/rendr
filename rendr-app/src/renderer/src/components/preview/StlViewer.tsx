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
import { Loader2, AlertCircle, Download, RotateCcw } from 'lucide-react'
import { scadToStl } from '@/lib/openscad'
import { cn } from '@/lib/utils'
import { ViewerControls } from './ViewerControls'

interface StlViewerProps {
  code: string
}

// Default material values
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

    // Parse the base color and apply brightness
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

// Polygon count helper
function calculatePolygonCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return Math.floor(geometry.index.count / 3)
  }
  if (geometry.attributes.position) {
    return Math.floor(geometry.attributes.position.count / 3)
  }
  return 0
}

// Global cache so geometry survives tab switches / remounts
const cache: { code: string; geometry: THREE.BufferGeometry } | null = {
  code: '',
  geometry: null as any
}

export function StlViewer({ code }: StlViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(
    cache?.code === code ? cache.geometry : null
  )
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Building 3D model...')
  const [error, setError] = useState<string | null>(null)
  const renderingRef = useRef('')

  // Viewer state
  const [isOrthographic, setIsOrthographic] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('solid')
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS)
  const [roughness, setRoughness] = useState(DEFAULT_ROUGHNESS)
  const [metalness, setMetalness] = useState(DEFAULT_METALNESS)
  const [modelColor] = useState('#4a9eff')
  const [polygonCount, setPolygonCount] = useState<number | undefined>(undefined)

  // STL binary data for download
  const stlBufferRef = useRef<ArrayBuffer | null>(null)

  useEffect(() => {
    if (!code) return

    if (cache?.code === code && cache.geometry) {
      setGeometry(cache.geometry)
      setPolygonCount(calculatePolygonCount(cache.geometry))
      return
    }

    if (renderingRef.current === code) return
    renderingRef.current = code

    setLoading(true)
    setLoadingMessage('Initializing OpenSCAD...')
    setError(null)
    setGeometry(null)
    setPolygonCount(undefined)

    const thisCode = code

    scadToStl(thisCode, (status) => {
      if (renderingRef.current === thisCode) setLoadingMessage(status)
    })
      .then((buffer) => {
        const loader = new STLLoader()
        const geo = loader.parse(buffer)
        geo.center()


        // Store buffer for download
        stlBufferRef.current = buffer

        if (renderingRef.current === thisCode) {
          setGeometry(geo)
          setPolygonCount(calculatePolygonCount(geo))
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

  const handleReset = useCallback(() => {
    setBrightness(DEFAULT_BRIGHTNESS)
    setRoughness(DEFAULT_ROUGHNESS)
    setMetalness(DEFAULT_METALNESS)
    setViewMode('solid')
  }, [])

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="mb-2 h-6 w-6 animate-spin text-vsc-blue" />
        <p className="text-[13px] text-vsc-text-dim">{loadingMessage}</p>
        <p className="mt-1 text-[11px] text-vsc-text-dimmer">First load may take a moment</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-[13px] text-vsc-text-dim">3D viewer error</p>
        <p className="max-w-xs text-center text-[11px] text-vsc-text-dimmer">{error}</p>
      </div>
    )
  }

  if (!geometry) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-[13px] text-vsc-text-dim">No model to display</p>
      </div>
    )
  }

  const isWireframe = viewMode === 'wireframe'

  return (
    <div className="relative h-full w-full">
      <Canvas
        gl={{ antialias: true, powerPreference: 'default', toneMapping: THREE.NoToneMapping }}
        style={{ background: '#1e1e1e' }}
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

      {/* Viewer controls panel - top right */}
      <ViewerControls
        brightness={brightness}
        roughness={roughness}
        metalness={metalness}
        polygonCount={polygonCount}
        onBrightnessChange={setBrightness}
        onRoughnessChange={setRoughness}
        onMetalnessChange={setMetalness}
        onReset={handleReset}
        defaultBrightness={DEFAULT_BRIGHTNESS}
        defaultRoughness={DEFAULT_ROUGHNESS}
        defaultMetalness={DEFAULT_METALNESS}
      />

      {/* Bottom controls bar */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-md border border-vsc-border bg-vsc-sidebar/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setViewMode('solid')}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              viewMode === 'solid'
                ? 'bg-vsc-blue text-white'
                : 'text-vsc-text-dim hover:text-vsc-text'
            )}
          >
            Solid
          </button>
          <button
            onClick={() => setViewMode('wireframe')}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              viewMode === 'wireframe'
                ? 'bg-vsc-blue text-white'
                : 'text-vsc-text-dim hover:text-vsc-text'
            )}
          >
            Wireframe
          </button>
        </div>

        {/* Camera toggle */}
        <div className="flex items-center gap-1 rounded-md border border-vsc-border bg-vsc-sidebar/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          <button
            onClick={() => setIsOrthographic(false)}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              !isOrthographic
                ? 'bg-vsc-blue text-white'
                : 'text-vsc-text-dim hover:text-vsc-text'
            )}
            title="Perspective camera"
          >
            Persp
          </button>
          <button
            onClick={() => setIsOrthographic(true)}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              isOrthographic
                ? 'bg-vsc-blue text-white'
                : 'text-vsc-text-dim hover:text-vsc-text'
            )}
            title="Orthographic camera"
          >
            Ortho
          </button>
        </div>
      </div>

      {/* Download button - bottom right */}
      {stlBufferRef.current && (
        <button
          onClick={handleDownloadStl}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md border border-vsc-border bg-vsc-sidebar/95 px-3 py-1.5 text-[11px] font-medium text-vsc-text-dim shadow-lg backdrop-blur-sm transition-colors hover:text-vsc-text"
          title="Download STL"
        >
          <Download className="h-3.5 w-3.5" />
          Download STL
        </button>
      )}
    </div>
  )
}

import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { Loader2, AlertCircle } from 'lucide-react'
import { scadToStl } from '@/lib/openscad'

interface StlViewerProps {
  code: string
}

function StlModel({ geometry }: { geometry: THREE.BufferGeometry }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4a9eff',
        metalness: 0.15,
        roughness: 0.6,
        flatShading: false
      }),
    []
  )

  useEffect(() => {
    geometry.computeVertexNormals()
  }, [geometry])

  return (
    <Center>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </Center>
  )
}

// Global cache so geometry survives tab switches / remounts
const cache: { code: string; geometry: THREE.BufferGeometry } | null = { code: '', geometry: null as any }

export function StlViewer({ code }: StlViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(
    cache?.code === code ? cache.geometry : null
  )
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Building 3D model...')
  const [error, setError] = useState<string | null>(null)
  const renderingRef = useRef('')

  useEffect(() => {
    if (!code) return

    // Already have cached geometry for this code
    if (cache?.code === code && cache.geometry) {
      setGeometry(cache.geometry)
      return
    }

    // Already rendering this code
    if (renderingRef.current === code) return
    renderingRef.current = code

    setLoading(true)
    setLoadingMessage('Initializing OpenSCAD...')
    setError(null)
    setGeometry(null)

    const thisCode = code

    scadToStl(thisCode, (status) => {
      if (renderingRef.current === thisCode) setLoadingMessage(status)
    })
      .then((buffer) => {
        const loader = new STLLoader()
        const geo = loader.parse(buffer)

        // Cache globally
        cache.code = thisCode
        cache.geometry = geo

        // Only update state if this is still the current render
        if (renderingRef.current === thisCode) {
          setGeometry(geo)
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

  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [100, 100, 100], fov: 50, near: 0.1, far: 10000 }}
        gl={{ antialias: true, powerPreference: 'default' }}
        style={{ background: '#1e1e1e' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
          canvas.addEventListener('webglcontextrestored', () => gl.resetState())
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 80, 50]} intensity={0.8} />
        <directionalLight position={[-30, -20, -50]} intensity={0.3} />
        <StlModel geometry={geometry} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        <gridHelper args={[200, 20, '#333333', '#262626']} />
      </Canvas>
    </div>
  )
}

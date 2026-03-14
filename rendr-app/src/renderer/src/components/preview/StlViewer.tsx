// @ts-nocheck
import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Loader2, AlertCircle } from 'lucide-react'
import { compileScad } from '@/lib/openscad'
import { parseOff } from '../../../openscad-playground/src/io/import_off'
import { exportGlb } from '../../../openscad-playground/src/io/export_glb'

interface StlViewerProps {
  code: string
}

let cache: { code: string; glbArrayBuffer: ArrayBuffer } | null = null

function GlbModel({ buffer }: { buffer: ArrayBuffer }) {
  const [scene, setScene] = useState<THREE.Group | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.parse(buffer, '', (gltf) => {
      console.log('[GlbModel] GLTF loaded, scene children:', gltf.scene.children.length)
      setScene(gltf.scene)
    }, (err) => {
      console.error('[GlbModel] GLTFLoader error:', err)
    })
  }, [buffer])

  useEffect(() => {
    if (!scene) return

    // OpenSCAD is Z-up, Three.js is Y-up: rotate -90° around X
    scene.rotation.x = -Math.PI / 2

    // Auto-fit camera to model
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const dist = maxDim * 2

    // Center the model
    scene.position.x = -center.x
    scene.position.y = -center.y
    scene.position.z = -center.z

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7)
      camera.near = maxDim * 0.01
      camera.far = maxDim * 100
      camera.updateProjectionMatrix()
    }
    camera.lookAt(0, 0, 0)
  }, [scene, camera])

  if (!scene) return null

  // Ensure all materials are visible with proper coloring
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const mat = child.material as THREE.MeshStandardMaterial
      mat.metalness = 0
      mat.roughness = 0.6
    }
  })

  return <primitive object={scene} />
}

export function StlViewer({ code }: StlViewerProps) {
  const [glbBuffer, setGlbBuffer] = useState<ArrayBuffer | null>(
    cache?.code === code ? cache.glbArrayBuffer : null
  )
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Building 3D model...')
  const [error, setError] = useState<string | null>(null)
  const renderingRef = useRef('')

  useEffect(() => {
    if (!code) return

    if (cache?.code === code && cache.glbArrayBuffer) {
      setGlbBuffer(cache.glbArrayBuffer)
      return
    }

    if (renderingRef.current === code) return
    renderingRef.current = code

    setLoading(true)
    setLoadingMessage('Initializing OpenSCAD...')
    setError(null)
    setGlbBuffer(null)

    const thisCode = code

    compileScad(thisCode, (status) => {
      if (renderingRef.current === thisCode) setLoadingMessage(status)
    })
      .then(async (output) => {
        if (renderingRef.current !== thisCode) return

        setLoadingMessage('Converting to 3D view...')

        if (output.format === 'off' && output.offText) {
          const polyhedron = parseOff(output.offText)
          const blob = await exportGlb(polyhedron)
          const arrayBuffer = await blob.arrayBuffer()

          cache = { code: thisCode, glbArrayBuffer: arrayBuffer }

          if (renderingRef.current === thisCode) {
            setGlbBuffer(arrayBuffer)
            setLoading(false)
          }
        } else {
          throw new Error('No OFF output from OpenSCAD')
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

  if (!glbBuffer) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-[13px] text-vsc-text-dim">No model to display</p>
      </div>
    )
  }

  return (
    <Canvas
      gl={{ antialias: true }}
      camera={{ fov: 50 }}
      style={{ width: '100%', height: '100%', background: '#1e1e1e' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <directionalLight position={[-5, -3, 4]} intensity={0.6} />
      <directionalLight position={[0, -5, -5]} intensity={0.3} />
      <Suspense fallback={null}>
        <GlbModel buffer={glbBuffer} />
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  )
}

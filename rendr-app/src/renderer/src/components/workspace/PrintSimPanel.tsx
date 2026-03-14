import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'
import { useMeshAnalytics } from '@/contexts/MeshAnalyticsContext'
import { Box, Play, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const LAYER_HEIGHT = 0.2 // mm per layer

function PrintModel({
  geometry,
  clipY,
  totalHeight
}: {
  geometry: THREE.BufferGeometry
  clipY: number
  totalHeight: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const nozzleRef = useRef<THREE.Mesh>(null)

  const clippingPlane = useMemo(() => {
    // Clip everything above clipY (in model space, Y is up after rotation)
    return new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)
  }, [clipY])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c0c0c0'),
      metalness: 0.15,
      roughness: 0.6,
      clippingPlanes: [clippingPlane],
      clipShadows: true,
      side: THREE.DoubleSide
    })
  }, [clippingPlane])

  // Cross-section highlight at the clip plane
  const sectionMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#22c55e'),
      side: THREE.BackSide,
      clippingPlanes: [clippingPlane]
    })
  }, [clippingPlane])

  useEffect(() => {
    geometry.computeVertexNormals()
  }, [geometry])

  // Nozzle indicator animation
  useFrame(({ clock }) => {
    if (nozzleRef.current) {
      const t = clock.getElapsedTime()
      nozzleRef.current.position.x = Math.sin(t * 2) * 5
      nozzleRef.current.position.z = Math.cos(t * 2) * 5
      nozzleRef.current.position.y = clipY
    }
  })

  return (
    <Center>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={meshRef} geometry={geometry} material={material} />
      </group>
      {/* Nozzle indicator */}
      <mesh ref={nozzleRef}>
        <cylinderGeometry args={[0.3, 0.8, 2, 8]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
      </mesh>
      {/* Build plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -totalHeight / 2 - 0.5, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.8} />
      </mesh>
      {/* Build plate grid */}
      <gridHelper
        args={[200, 20, '#2a2a2a', '#1e1e1e']}
        position={[0, -totalHeight / 2 - 0.4, 0]}
      />
    </Center>
  )
}

function PrintScene({
  geometry,
  clipY,
  totalHeight
}: {
  geometry: THREE.BufferGeometry
  clipY: number
  totalHeight: number
}) {
  return (
    <Canvas
      gl={{
        antialias: true,
        localClippingEnabled: true,
        toneMapping: THREE.NoToneMapping
      }}
      camera={{ position: [80, 60, 80], fov: 45 }}
      style={{ background: '#0a0a0a' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 50]} intensity={1} />
      <directionalLight position={[-30, 20, -30]} intensity={0.3} />
      <PrintModel geometry={geometry} clipY={clipY} totalHeight={totalHeight} />
      <OrbitControls enableDamping dampingFactor={0.05} />
    </Canvas>
  )
}

export function PrintSimPanel() {
  const { geometry, analytics } = useMeshAnalytics()

  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0 to 1
  const [speed, setSpeed] = useState(1)
  const animRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const totalHeight = useMemo(() => {
    if (!analytics) return 0
    // Use bounding box height (which is depth in the rotated model)
    return Math.max(analytics.boundingBox.width, analytics.boundingBox.height, analytics.boundingBox.depth)
  }, [analytics])

  const totalLayers = useMemo(() => {
    return Math.ceil(totalHeight / LAYER_HEIGHT)
  }, [totalHeight])

  const currentLayer = Math.floor(progress * totalLayers)

  // The clip Y position: goes from bottom to top of model
  const clipY = useMemo(() => {
    return -totalHeight / 2 + progress * totalHeight
  }, [progress, totalHeight])

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp
    const dt = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    setProgress((prev) => {
      const next = prev + dt * speed * 0.05
      if (next >= 1) {
        setPlaying(false)
        return 1
      }
      return next
    })

    animRef.current = requestAnimationFrame(animate)
  }, [speed])

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = 0
      animRef.current = requestAnimationFrame(animate)
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [playing, animate])

  const handleReset = () => {
    setPlaying(false)
    setProgress(0)
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(parseFloat(e.target.value))
  }

  if (!geometry || !analytics) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <Box className="mb-3 h-8 w-8 text-r-text-dim/30" strokeWidth={1} />
        <p className="text-center text-xs text-r-text-dim">
          generate a model to see print simulation
        </p>
      </div>
    )
  }

  const elapsedTime = progress * (totalLayers * LAYER_HEIGHT / 60 * speed)
  const heightPrinted = (progress * totalHeight).toFixed(1)

  return (
    <div className="flex h-full flex-col">
      {/* 3D Preview */}
      <div className="relative h-64 shrink-0 border-b border-r-border/30">
        <PrintScene geometry={geometry} clipY={clipY} totalHeight={totalHeight} />
        {/* Layer counter overlay */}
        <div className="absolute left-2 top-2 rounded-md bg-r-bg/80 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono text-2xs text-r-text-secondary">
            layer {currentLayer}/{totalLayers}
          </span>
        </div>
        <div className="absolute right-2 top-2 rounded-md bg-r-bg/80 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono text-2xs text-r-success">
            {(progress * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b border-r-border/30 px-4 py-3">
        {/* Progress slider */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleSliderChange}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-r-elevated [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-r-text"
          />
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying(!playing)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-r-elevated text-r-text transition-colors hover:bg-r-overlay"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleReset}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-r-elevated text-r-text-muted transition-colors hover:bg-r-overlay hover:text-r-text"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1" />

          {/* Speed control */}
          <div className="flex items-center gap-1 rounded-lg bg-r-elevated px-2 py-1">
            <button
              onClick={() => setSpeed(Math.max(0.25, speed - 0.25))}
              className="text-r-text-muted hover:text-r-text"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <span className="min-w-[32px] text-center font-mono text-2xs text-r-text-secondary">
              {speed}x
            </span>
            <button
              onClick={() => setSpeed(Math.min(5, speed + 0.25))}
              className="text-r-text-muted hover:text-r-text"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 text-2xs font-medium uppercase tracking-widest text-r-text-dim">
          print progress
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-r-text-muted">layers printed</span>
            <span className="font-mono text-xs text-r-text-secondary">{currentLayer} / {totalLayers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-r-text-muted">height</span>
            <span className="font-mono text-xs text-r-text-secondary">{heightPrinted} mm</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-r-text-muted">layer height</span>
            <span className="font-mono text-xs text-r-text-secondary">{LAYER_HEIGHT} mm</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-r-text-muted">total height</span>
            <span className="font-mono text-xs text-r-text-secondary">{totalHeight.toFixed(1)} mm</span>
          </div>

          {/* Visual layer bar */}
          <div className="mt-3">
            <div className="mb-1.5 text-2xs text-r-text-dim">build progress</div>
            <div className="relative h-32 w-full overflow-hidden rounded-lg border border-r-border/30 bg-r-bg/50">
              {/* Filled portion */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-100"
                style={{
                  height: `${progress * 100}%`,
                  background: 'linear-gradient(to top, #22c55e22, #22c55e08)'
                }}
              />
              {/* Layer lines */}
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-r-border/20"
                  style={{ bottom: `${(i + 1) * 10}%` }}
                />
              ))}
              {/* Current layer indicator */}
              <div
                className="absolute left-0 right-0 h-0.5 bg-r-success transition-all duration-100"
                style={{ bottom: `${progress * 100}%` }}
              />
              {/* Percentage label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-lg text-r-text-dim">
                  {(progress * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

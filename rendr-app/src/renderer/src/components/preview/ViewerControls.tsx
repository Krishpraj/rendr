import { useState, useEffect } from 'react'
import { ChevronDown, RotateCcw, Sun, Gem, Hash, Settings } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface ViewerControlsProps {
  brightness: number
  roughness: number
  metalness: number
  polygonCount?: number
  onBrightnessChange: (value: number) => void
  onRoughnessChange: (value: number) => void
  onMetalnessChange: (value: number) => void
  onReset: () => void
  defaultBrightness: number
  defaultRoughness: number
  defaultMetalness: number
}

export function ViewerControls({
  brightness,
  roughness,
  metalness,
  polygonCount,
  onBrightnessChange,
  onRoughnessChange,
  onMetalnessChange,
  onReset,
  defaultBrightness,
  defaultRoughness,
  defaultMetalness
}: ViewerControlsProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem('rendr-viewer-controls-open') !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('rendr-viewer-controls-open', isOpen.toString())
    } catch {
      // ignore storage errors
    }
  }, [isOpen])

  const brightnessChanged = brightness !== defaultBrightness
  const roughnessChanged = roughness !== defaultRoughness
  const metalnessChanged = metalness !== defaultMetalness
  const anyChanged = brightnessChanged || roughnessChanged || metalnessChanged

  const formatPolygonCount = (count?: number) => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toLocaleString()
  }

  return (
    <div className="absolute right-3 top-3 w-56 overflow-hidden rounded-md border border-vsc-border bg-vsc-sidebar/95 shadow-lg backdrop-blur-sm transition-all">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center justify-between border-b border-vsc-border px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5 text-vsc-text-dim" />
          <span className="text-[12px] font-medium text-vsc-text-dim">Controls</span>
        </div>
        <div className="flex items-center gap-1.5">
          {anyChanged && (
            <button
              className="rounded p-0.5 text-vsc-text-dimmer hover:text-vsc-blue transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onReset()
              }}
              title="Reset all to defaults"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-vsc-text-dimmer transition-transform',
              isOpen ? 'rotate-180' : ''
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3 px-3 py-3">
          {/* Brightness */}
          <ControlRow
            icon={<Sun className="h-3.5 w-3.5" />}
            label="Brightness"
            value={brightness}
            defaultValue={defaultBrightness}
            onChange={onBrightnessChange}
            changed={brightnessChanged}
          />

          {/* Roughness */}
          <ControlRow
            icon={<Gem className="h-3.5 w-3.5" />}
            label="Roughness"
            value={roughness}
            defaultValue={defaultRoughness}
            onChange={onRoughnessChange}
            changed={roughnessChanged}
          />

          {/* Metalness */}
          <ControlRow
            icon={<Gem className="h-3.5 w-3.5" />}
            label="Metalness"
            value={metalness}
            defaultValue={defaultMetalness}
            onChange={onMetalnessChange}
            changed={metalnessChanged}
          />

          {/* Polygon count */}
          {polygonCount !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-vsc-border">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-vsc-text-dimmer" />
                <span className="text-[11px] text-vsc-text-dim">Polygons</span>
              </div>
              <span className="font-mono text-[11px] text-vsc-text-dim">
                {formatPolygonCount(polygonCount)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ControlRow({
  icon,
  label,
  value,
  defaultValue,
  onChange,
  changed
}: {
  icon: React.ReactNode
  label: string
  value: number
  defaultValue: number
  onChange: (value: number) => void
  changed: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-vsc-text-dimmer">{icon}</span>
          <span className="text-[11px] text-vsc-text-dim">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {changed && (
            <button
              className="rounded p-0.5 text-vsc-text-dimmer hover:text-vsc-blue transition-colors"
              onClick={() => onChange(defaultValue)}
              title={`Reset ${label.toLowerCase()}`}
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          )}
          <span className="w-7 text-right font-mono text-[11px] text-vsc-text-dim">
            {Math.round(value)}
          </span>
        </div>
      </div>
      <Slider
        value={[value]}
        defaultValue={[defaultValue]}
        min={0}
        max={100}
        step={1}
        onValueChange={(values) => onChange(values[0])}
        className="py-0.5"
      />
    </div>
  )
}

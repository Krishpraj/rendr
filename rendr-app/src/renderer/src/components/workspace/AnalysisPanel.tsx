import { useMemo } from 'react'
import { useMeshAnalytics } from '@/contexts/MeshAnalyticsContext'
import { formatNumber, formatSize } from '@/lib/meshAnalytics'
import {
  Box,
  Ruler,
  Scale,
  Droplets,
  Shield,
  Printer,
  Weight,
  Clock,
  Layers,
  CircleDot,
  TriangleAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Material densities in g/mm³
const MATERIALS = [
  { name: 'PLA', density: 0.00125, color: '#22c55e' },
  { name: 'ABS', density: 0.00105, color: '#f59e0b' },
  { name: 'PETG', density: 0.00127, color: '#3b82f6' },
  { name: 'Resin', density: 0.00120, color: '#a855f7' },
  { name: 'Nylon', density: 0.00110, color: '#ec4899' },
  { name: 'TPU', density: 0.00121, color: '#06b6d4' }
]

// Rough print time estimate: based on volume + surface area
function estimatePrintTime(volumeMm3: number, surfaceAreaMm2: number): string {
  // ~60mm³/min for FDM at 0.2mm layer height, plus travel time based on surface
  const volumeMinutes = volumeMm3 / 60
  const travelMinutes = surfaceAreaMm2 / 500
  const totalMinutes = Math.round(volumeMinutes + travelMinutes)
  if (totalMinutes < 60) return `~${totalMinutes}min`
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `~${hrs}h ${mins}m`
}

function estimateCost(weightG: number): string {
  // ~$25/kg average for PLA
  const cost = (weightG / 1000) * 25
  if (cost < 0.01) return '<$0.01'
  return `~$${cost.toFixed(2)}`
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Box; children: React.ReactNode }) {
  return (
    <div className="border-b border-r-border/30 px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-r-text-dim" />
        <span className="text-2xs font-medium uppercase tracking-widest text-r-text-dim">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-xs text-r-text-muted">{label}</span>
      <span className={cn('font-mono text-xs', highlight ? 'text-r-text' : 'text-r-text-secondary')}>
        {value}
        {unit && <span className="ml-0.5 text-2xs text-r-text-dim">{unit}</span>}
      </span>
    </div>
  )
}

function QualityBadge({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={cn('h-2 w-2 rounded-full', ok ? 'bg-r-success' : 'bg-r-warning')} />
      <div className="flex-1">
        <div className="text-xs text-r-text-secondary">{label}</div>
        <div className="text-2xs text-r-text-dim">{detail}</div>
      </div>
    </div>
  )
}

export function AnalysisPanel() {
  const { analytics, stlSize } = useMeshAnalytics()

  const printEstimates = useMemo(() => {
    if (!analytics || analytics.volume <= 0) return null
    return MATERIALS.map((mat) => {
      const weight = analytics.volume * mat.density
      return { ...mat, weight }
    })
  }, [analytics])

  const printTime = useMemo(() => {
    if (!analytics || analytics.volume <= 0) return null
    return estimatePrintTime(analytics.volume, analytics.surfaceArea)
  }, [analytics])

  const qualityChecks = useMemo(() => {
    if (!analytics) return []
    const checks = []

    checks.push({
      ok: analytics.isWatertight,
      label: 'Manifold mesh',
      detail: analytics.isWatertight ? 'Mesh is closed and printable' : 'Open edges detected — may fail to slice'
    })

    checks.push({
      ok: analytics.triangles > 0,
      label: 'Geometry valid',
      detail: analytics.triangles > 0
        ? `${formatNumber(analytics.triangles)} triangles`
        : 'No geometry found'
    })

    checks.push({
      ok: analytics.volume > 0,
      label: 'Positive volume',
      detail: analytics.volume > 0
        ? `${formatNumber(analytics.volume)} mm³`
        : 'Zero or negative volume — check normals'
    })

    const ratio = analytics.surfaceArea > 0
      ? analytics.volume / analytics.surfaceArea
      : 0
    checks.push({
      ok: ratio > 0.5,
      label: 'Wall thickness',
      detail: ratio > 0.5
        ? `Vol/SA ratio: ${ratio.toFixed(2)} — adequate`
        : `Vol/SA ratio: ${ratio.toFixed(2)} — thin walls may break`
    })

    checks.push({
      ok: analytics.genus === 0,
      label: 'Simple topology',
      detail: analytics.genus === 0
        ? 'No holes or handles'
        : `Genus ${analytics.genus} — ${analytics.genus} hole(s) detected`
    })

    return checks
  }, [analytics])

  if (!analytics) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        <Box className="mb-3 h-8 w-8 text-r-text-dim/30" strokeWidth={1} />
        <p className="text-center text-xs text-r-text-dim">
          generate a model to see analysis
        </p>
      </div>
    )
  }

  const bb = analytics.boundingBox

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Geometry */}
      <Section title="Geometry" icon={Layers}>
        <div className="grid grid-cols-3 gap-x-3">
          <Stat label="vertices" value={formatNumber(analytics.vertices)} highlight />
          <Stat label="triangles" value={formatNumber(analytics.triangles)} highlight />
          <Stat label="edges" value={formatNumber(analytics.edges)} highlight />
        </div>
      </Section>

      {/* Dimensions */}
      <Section title="Dimensions" icon={Ruler}>
        <div className="space-y-0.5">
          <Stat label="width (X)" value={formatSize(bb.width)} />
          <Stat label="height (Y)" value={formatSize(bb.height)} />
          <Stat label="depth (Z)" value={formatSize(bb.depth)} />
        </div>
        <div className="mt-2 rounded-md bg-r-bg/50 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <CircleDot className="h-3 w-3 text-r-text-dim" />
            <span className="text-2xs text-r-text-dim">center of mass</span>
          </div>
          <div className="mt-1 font-mono text-2xs text-r-text-muted">
            ({analytics.centerOfMass.x}, {analytics.centerOfMass.y}, {analytics.centerOfMass.z})
          </div>
        </div>
      </Section>

      {/* Physical Properties */}
      <Section title="Physical" icon={Scale}>
        <div className="space-y-0.5">
          <Stat label="surface area" value={formatNumber(analytics.surfaceArea)} unit="mm²" highlight />
          <Stat label="volume" value={formatNumber(analytics.volume)} unit="mm³" highlight />
          {stlSize && (
            <Stat label="file size" value={stlSize > 1024 * 1024
              ? `${(stlSize / (1024 * 1024)).toFixed(1)} MB`
              : `${(stlSize / 1024).toFixed(0)} KB`
            } />
          )}
        </div>
      </Section>

      {/* Print Readiness */}
      <Section title="Print Readiness" icon={Shield}>
        <div className="space-y-0.5">
          {qualityChecks.map((check, i) => (
            <QualityBadge key={i} {...check} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-md bg-r-bg/50 px-2.5 py-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            qualityChecks.every(c => c.ok) ? 'bg-r-success/10' : 'bg-r-warning/10'
          )}>
            {qualityChecks.every(c => c.ok) ? (
              <Shield className="h-4 w-4 text-r-success" />
            ) : (
              <TriangleAlert className="h-4 w-4 text-r-warning" />
            )}
          </div>
          <div>
            <div className="text-xs text-r-text-secondary">
              {qualityChecks.every(c => c.ok) ? 'Ready to print' : 'Issues detected'}
            </div>
            <div className="text-2xs text-r-text-dim">
              {qualityChecks.filter(c => c.ok).length}/{qualityChecks.length} checks passed
            </div>
          </div>
        </div>
      </Section>

      {/* 3D Print Estimates */}
      {printEstimates && (
        <Section title="Print Estimates" icon={Printer}>
          {printTime && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-r-bg/50 px-2.5 py-2">
              <Clock className="h-3.5 w-3.5 text-r-text-dim" />
              <div>
                <div className="text-xs text-r-text-secondary">estimated print time</div>
                <div className="font-mono text-xs text-r-text">{printTime}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {printEstimates.map((mat) => (
              <div key={mat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mat.color }} />
                  <span className="text-xs text-r-text-muted">{mat.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xs text-r-text-secondary">
                    {mat.weight < 1 ? `${(mat.weight * 1000).toFixed(0)}mg` : `${mat.weight.toFixed(1)}g`}
                  </span>
                  <span className="font-mono text-2xs text-r-text-dim">
                    {estimateCost(mat.weight)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 text-2xs text-r-text-dim">
            * estimates based on 100% infill, 0.2mm layer height
          </div>
        </Section>
      )}

      {/* Topology */}
      <Section title="Topology" icon={Droplets}>
        <div className="space-y-0.5">
          <Stat label="watertight" value={analytics.isWatertight ? 'yes' : 'no'} />
          <Stat label="genus" value={String(analytics.genus)} />
          <Stat label="euler char." value={String(analytics.vertices - analytics.edges + analytics.triangles)} />
        </div>
      </Section>
    </div>
  )
}

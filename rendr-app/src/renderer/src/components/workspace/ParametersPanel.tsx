import { useState, useEffect, useRef, useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { RotateCcw, Loader2 } from 'lucide-react'
import type { Parameter } from '@/types'

export function ParametersPanel() {
  const { currentProject, updateProjectCode } = useProject()
  const [localParams, setLocalParams] = useState<Parameter[]>([])
  const [isApplying, setIsApplying] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<Map<string, string | number | boolean>>(new Map())

  useEffect(() => {
    setLocalParams(currentProject?.parameters || [])
    pendingUpdatesRef.current.clear()
  }, [currentProject?.parameters])

  const applyUpdates = useCallback(async () => {
    if (!currentProject?.code || pendingUpdatesRef.current.size === 0) return

    const updates = Array.from(pendingUpdatesRef.current.entries()).map(([name, value]) => ({
      name,
      value: String(value)
    }))
    pendingUpdatesRef.current.clear()

    setIsApplying(true)
    try {
      const result = await api.updateParams({ code: currentProject.code, updates })
      updateProjectCode(result.code, result.parameters, null)
    } catch (err) {
      toast.error(`Parameter update failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsApplying(false)
    }
  }, [currentProject?.code, updateProjectCode])

  const updateParam = useCallback((name: string, value: number | string | boolean) => {
    setLocalParams((prev) => prev.map((p) => (p.name === name ? { ...p, value } : p)))
    pendingUpdatesRef.current.set(name, value)

    // Debounce the API call
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      applyUpdates()
    }, 600)
  }, [applyUpdates])

  const handleReset = () => {
    setLocalParams((prev) => {
      const reset = prev.map((p) => ({ ...p, value: p.default_value }))
      // Queue all resets
      reset.forEach((p) => {
        if (String(p.value) !== String(currentProject?.parameters.find((cp) => cp.name === p.name)?.value)) {
          pendingUpdatesRef.current.set(p.name, p.value as string | number | boolean)
        }
      })
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        applyUpdates()
      }, 300)
      return reset
    })
  }

  if (!currentProject || localParams.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-center text-xs text-r-text-dim">
          {currentProject ? 'no parameters yet — generate a model first' : 'select a project'}
        </p>
      </div>
    )
  }

  // Group parameters
  const groups = localParams.reduce<Record<string, Parameter[]>>((acc, p) => {
    const group = p.group || 'General'
    if (!acc[group]) acc[group] = []
    acc[group].push(p)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      {/* Header with status */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-r-border/30 px-4">
        <div className="flex items-center gap-2">
          {isApplying && (
            <Loader2 className="h-3 w-3 animate-spin text-r-accent" />
          )}
          <span className="text-2xs text-r-text-dim">
            {isApplying ? 'applying...' : 'auto-apply on change'}
          </span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-2xs text-r-text-dim transition-colors hover:bg-r-elevated hover:text-r-text-muted"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          reset
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {Object.entries(groups).map(([groupName, params]) => (
            <div key={groupName}>
              <div className="mb-3 text-2xs font-medium uppercase tracking-widest text-r-text-dim">
                {groupName}
              </div>
              <div className="space-y-4">
                {params.map((param) => (
                  <div key={param.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs text-r-text-secondary">
                        {param.display_name}
                      </label>
                      <span className="font-mono text-2xs text-r-text-muted">
                        {typeof param.value === 'boolean' ? (param.value ? 'on' : 'off') : String(param.value)}
                      </span>
                    </div>
                    {param.type === 'boolean' ? (
                      <button
                        onClick={() => updateParam(param.name, !param.value)}
                        className={`h-5 w-9 rounded-full transition-colors ${
                          param.value ? 'bg-r-accent' : 'bg-r-elevated'
                        }`}
                      >
                        <div
                          className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            param.value ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                        />
                      </button>
                    ) : param.range ? (
                      <Slider
                        value={[Number(param.value)]}
                        min={param.range.min ?? 0}
                        max={param.range.max ?? 100}
                        step={param.range.step ?? 1}
                        onValueChange={([v]) => updateParam(param.name, v)}
                      />
                    ) : (
                      <input
                        value={String(param.value)}
                        onChange={(e) => {
                          const v = param.type === 'number' ? Number(e.target.value) : e.target.value
                          updateParam(param.name, v)
                        }}
                        className="h-7 w-full rounded-md border border-r-border bg-r-input-bg px-2.5 font-mono text-xs text-r-text outline-none transition-colors focus:border-r-accent/50"
                      />
                    )}
                    {param.description && (
                      <p className="mt-1 text-2xs text-r-text-dim">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

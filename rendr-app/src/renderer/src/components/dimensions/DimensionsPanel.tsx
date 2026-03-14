import { useState, useEffect } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { RotateCcw, Check } from 'lucide-react'
import type { Parameter } from '@/types'

export function DimensionsPanel() {
  const { currentProject, updateProjectCode } = useProject()
  const [localParams, setLocalParams] = useState<Parameter[]>([])
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    setLocalParams(currentProject?.parameters || [])
  }, [currentProject?.parameters])

  if (!currentProject || localParams.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-[13px] text-vsc-text-dimmer">
          {currentProject ? 'No parameters extracted yet' : 'Select a project to view dimensions'}
        </p>
      </div>
    )
  }

  const updateParam = (name: string, value: number | string | boolean) => {
    setLocalParams((prev) => prev.map((p) => (p.name === name ? { ...p, value } : p)))
  }

  const handleApply = async () => {
    if (!currentProject?.code) return
    setIsApplying(true)
    try {
      const updates = localParams
        .filter((p, i) => {
          const orig = currentProject.parameters[i]
          return orig && String(p.value) !== String(orig.value)
        })
        .map((p) => ({ name: p.name, value: String(p.value) }))

      if (updates.length === 0) {
        toast.info('No changes to apply')
        setIsApplying(false)
        return
      }

      const result = await api.updateParams({ code: currentProject.code, updates })
      updateProjectCode(result.code, result.parameters, null)
      toast.success('Parameters updated')
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsApplying(false)
    }
  }

  const handleReset = () => {
    setLocalParams((prev) => prev.map((p) => ({ ...p, value: p.default_value })))
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
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {Object.entries(groups).map(([groupName, params]) => (
            <div key={groupName}>
              <div className="mb-2 flex h-[22px] items-center text-[11px] font-bold uppercase tracking-wide text-vsc-text-bright">
                {groupName}
              </div>
              <div className="space-y-3">
                {params.map((param) => (
                  <div key={param.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[13px] text-vsc-text">{param.display_name}</label>
                      <span className="font-mono text-2xs text-vsc-text-dim">
                        {typeof param.value === 'boolean' ? (param.value ? 'on' : 'off') : param.value}
                      </span>
                    </div>
                    {param.type === 'boolean' ? (
                      <button
                        onClick={() => updateParam(param.name, !param.value)}
                        className={`h-[14px] w-[28px] rounded-full transition-colors ${
                          param.value ? 'bg-vsc-blue' : 'bg-vsc-text-dimmer/40'
                        }`}
                      >
                        <div
                          className={`h-[10px] w-[10px] rounded-full bg-white shadow transition-transform ${
                            param.value ? 'translate-x-[14px]' : 'translate-x-[2px]'
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
                        className="h-6 w-full rounded-sm border border-vsc-input-border bg-vsc-input-bg px-2 text-[13px] text-vsc-text outline-none focus:border-vsc-blue"
                      />
                    )}
                    {param.description && (
                      <p className="mt-0.5 text-2xs text-vsc-text-dimmer">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex gap-1 border-t border-vsc-border p-2">
        <button
          onClick={handleReset}
          className="flex flex-1 items-center justify-center gap-1 rounded-sm py-1 text-[12px] text-vsc-text-dim hover:bg-vsc-list-hover"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying}
          className="flex flex-1 items-center justify-center gap-1 rounded-sm bg-vsc-blue py-1 text-[12px] text-white hover:bg-vsc-statusbar-hover disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {isApplying ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

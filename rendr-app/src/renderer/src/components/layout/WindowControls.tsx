import { Minus, Square, X } from 'lucide-react'

export function WindowControls() {
  return (
    <div
      className="flex items-center gap-0.5"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={() => window.api.windowMinimize()}
        className="flex h-8 w-10 items-center justify-center text-r-text-muted transition-colors hover:bg-r-elevated"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => window.api.windowMaximize()}
        className="flex h-8 w-10 items-center justify-center text-r-text-muted transition-colors hover:bg-r-elevated"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        onClick={() => window.api.windowClose()}
        className="flex h-8 w-10 items-center justify-center text-r-text-muted transition-colors hover:bg-red-500/80 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

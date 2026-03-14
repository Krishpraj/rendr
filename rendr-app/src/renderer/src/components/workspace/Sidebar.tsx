import { MessageSquare, Code2, SlidersHorizontal, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CodePanel } from './CodePanel'
import { ParametersPanel } from './ParametersPanel'
import { AnalysisPanel } from './AnalysisPanel'

type TabId = 'chat' | 'code' | 'params' | 'analysis'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const TABS = [
  { id: 'chat' as const, icon: MessageSquare, label: 'chat' },
  { id: 'code' as const, icon: Code2, label: 'code' },
  { id: 'params' as const, icon: SlidersHorizontal, label: 'params' },
  { id: 'analysis' as const, icon: BarChart3, label: 'analysis' }
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-r-surface">
      {/* Tab bar */}
      <div className="flex h-10 shrink-0 items-center border-b border-r-border/50 px-1">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md px-3 text-xs transition-all',
              activeTab === id
                ? 'bg-r-elevated text-r-text'
                : 'text-r-text-muted hover:text-r-text-secondary'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'code' && <CodePanel />}
        {activeTab === 'params' && <ParametersPanel />}
        {activeTab === 'analysis' && <AnalysisPanel />}
      </div>
    </div>
  )
}

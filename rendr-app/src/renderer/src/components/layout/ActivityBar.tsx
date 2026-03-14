import { Files, MessageSquare, Box, Settings } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ActivityBarProps {
  activeTab: 'explorer' | 'chat'
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
  onTabClick: (tab: 'explorer' | 'chat') => void
}

export function ActivityBar({ activeTab, isLeftCollapsed, isRightCollapsed, onTabClick }: ActivityBarProps) {
  const items = [
    {
      id: 'explorer' as const,
      icon: Files,
      label: 'Explorer',
      isActive: activeTab === 'explorer' && !isLeftCollapsed
    },
    {
      id: 'chat' as const,
      icon: MessageSquare,
      label: 'Chat',
      isActive: activeTab === 'chat' && !isRightCollapsed
    }
  ]

  return (
    <div className="flex w-[48px] flex-col items-center border-r border-vsc-border bg-vsc-activitybar py-0">
      {items.map(({ id, icon: Icon, label, isActive }) => (
        <Tooltip key={id} delayDuration={600}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabClick(id)}
              className={`relative flex h-[48px] w-full items-center justify-center transition-colors ${
                isActive
                  ? 'text-vsc-activitybar-active'
                  : 'text-vsc-activitybar-inactive hover:text-vsc-activitybar-active'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 h-full w-[2px] bg-vsc-activitybar-active" />
              )}
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-vsc-input-bg text-vsc-text border-vsc-border-light">
            {label}
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      <Tooltip delayDuration={600}>
        <TooltipTrigger asChild>
          <button className="flex h-[48px] w-full items-center justify-center text-vsc-activitybar-inactive hover:text-vsc-activitybar-active transition-colors">
            <Box className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-vsc-input-bg text-vsc-text border-vsc-border-light">
          3D Preview
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={600}>
        <TooltipTrigger asChild>
          <button className="flex h-[48px] w-full items-center justify-center text-vsc-activitybar-inactive hover:text-vsc-activitybar-active transition-colors mb-1">
            <Settings className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-vsc-input-bg text-vsc-text border-vsc-border-light">
          Settings
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

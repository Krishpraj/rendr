import { useRef, useState, useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import { TitleBar } from './TitleBar'
import { ActivityBar } from './ActivityBar'
import { StatusBar } from './StatusBar'
import { ProjectsSidebar } from '@/components/sidebar/ProjectsSidebar'
import { PreviewPanel } from '@/components/preview/PreviewPanel'
import { RightSidebar } from '@/components/sidebar/RightSidebar'

export function MainLayout() {
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'explorer' | 'chat'>('explorer')

  const toggleLeft = useCallback(() => {
    const panel = leftPanelRef.current
    if (!panel) return
    if (isLeftCollapsed) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [isLeftCollapsed])

  const toggleRight = useCallback(() => {
    const panel = rightPanelRef.current
    if (!panel) return
    if (isRightCollapsed) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [isRightCollapsed])

  const handleActivityClick = (tab: 'explorer' | 'chat') => {
    if (tab === 'explorer') {
      if (activeTab === 'explorer' && !isLeftCollapsed) {
        leftPanelRef.current?.collapse()
      } else {
        leftPanelRef.current?.expand()
        setActiveTab('explorer')
      }
    } else if (tab === 'chat') {
      if (activeTab === 'chat' && !isRightCollapsed) {
        rightPanelRef.current?.collapse()
      } else {
        rightPanelRef.current?.expand()
        setActiveTab('chat')
      }
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-vsc-bg-dark">
      {/* Title bar */}
      <TitleBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar
          activeTab={activeTab}
          isLeftCollapsed={isLeftCollapsed}
          isRightCollapsed={isRightCollapsed}
          onTabClick={handleActivityClick}
        />

        {/* Panels */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" autoSaveId="rendr-panels">
            {/* Projects Sidebar */}
            <Panel
              ref={leftPanelRef}
              collapsible
              defaultSize={17}
              minSize={12}
              maxSize={25}
              id="projects-panel"
              order={0}
              onCollapse={() => setIsLeftCollapsed(true)}
              onExpand={() => setIsLeftCollapsed(false)}
            >
              <ProjectsSidebar />
            </Panel>

            <PanelResizeHandle className="resize-handle" />

            {/* Preview Panel */}
            <Panel defaultSize={55} minSize={30} id="preview-panel" order={1}>
              <PreviewPanel />
            </Panel>

            <PanelResizeHandle className="resize-handle" />

            {/* Right Sidebar (Chat + Dimensions) */}
            <Panel
              ref={rightPanelRef}
              collapsible
              defaultSize={28}
              minSize={18}
              maxSize={40}
              id="right-panel"
              order={2}
              onCollapse={() => setIsRightCollapsed(true)}
              onExpand={() => setIsRightCollapsed(false)}
            >
              <RightSidebar />
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}

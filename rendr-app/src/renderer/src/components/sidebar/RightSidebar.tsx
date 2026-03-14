import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { DimensionsPanel } from '@/components/dimensions/DimensionsPanel'

export function RightSidebar() {
  return (
    <div className="flex h-full flex-col bg-vsc-sidebar">
      <Tabs defaultValue="chat" className="flex h-full flex-col">
        <TabsList className="h-[35px] w-full justify-start gap-0 rounded-none border-b border-vsc-border bg-transparent p-0">
          <TabsTrigger
            value="chat"
            className="h-full rounded-none border-b-2 border-transparent px-4 text-[11px] font-normal uppercase tracking-wide text-vsc-text-dim shadow-none data-[state=active]:border-vsc-activitybar-active data-[state=active]:bg-transparent data-[state=active]:text-vsc-text-bright data-[state=active]:shadow-none"
          >
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="dimensions"
            className="h-full rounded-none border-b-2 border-transparent px-4 text-[11px] font-normal uppercase tracking-wide text-vsc-text-dim shadow-none data-[state=active]:border-vsc-activitybar-active data-[state=active]:bg-transparent data-[state=active]:text-vsc-text-bright data-[state=active]:shadow-none"
          >
            Dimensions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
          <ChatPanel />
        </TabsContent>
        <TabsContent value="dimensions" className="mt-0 flex-1 overflow-hidden">
          <DimensionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

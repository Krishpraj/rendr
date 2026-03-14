import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1
    }
  }
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <ChatProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  color: '#fafafa',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '12px'
                }
              }}
            />
            <AppShell />
          </TooltipProvider>
        </ChatProvider>
      </ProjectProvider>
    </QueryClientProvider>
  )
}

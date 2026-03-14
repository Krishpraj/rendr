import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from 'sonner'
import { MainLayout } from '@/components/layout/MainLayout'

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
                  background: '#252526',
                  border: '1px solid #3c3c3c',
                  color: '#e5e5e5'
                }
              }}
            />
            <MainLayout />
          </TooltipProvider>
        </ChatProvider>
      </ProjectProvider>
    </QueryClientProvider>
  )
}

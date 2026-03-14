import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useBackendHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 10_000,
    retry: false
  })
}

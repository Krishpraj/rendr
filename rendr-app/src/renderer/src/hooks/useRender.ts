import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RenderRequest } from '@/types'

export function useRender() {
  return useMutation({
    mutationFn: (req: RenderRequest) => api.render(req)
  })
}

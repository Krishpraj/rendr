import type {
  EditRequest,
  EditResponse,
  HealthResponse,
  ParameterUpdateRequest,
  ParameterUpdateResponse,
  RenderRequest,
  RenderResponse,
  StreamEvent
} from '@/types'

const BASE_URL = 'http://localhost:8000/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  edit: (req: EditRequest) =>
    request<EditResponse>('/edit', {
      method: 'POST',
      body: JSON.stringify(req)
    }),

  editStream: async function* (req: EditRequest): AsyncGenerator<StreamEvent> {
    const res = await fetch(`${BASE_URL}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, stream: true })
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API error ${res.status}: ${text}`)
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line) as StreamEvent
        }
      }
    }
    if (buffer.trim()) {
      yield JSON.parse(buffer) as StreamEvent
    }
  },

  updateParams: (req: ParameterUpdateRequest) =>
    request<ParameterUpdateResponse>('/params', {
      method: 'POST',
      body: JSON.stringify(req)
    }),

  render: (req: RenderRequest) =>
    request<RenderResponse>('/render', {
      method: 'POST',
      body: JSON.stringify(req)
    })
}

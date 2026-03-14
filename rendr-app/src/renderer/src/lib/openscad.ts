let worker: Worker | null = null
let requestId = 0

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/openscad.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return worker
}

export function scadToStl(
  code: string,
  onStatus?: (message: string) => void
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const w = getWorker()
    const timeoutMs = 120_000

    const timer = setTimeout(() => {
      cleanup()
      worker?.terminate()
      worker = null
      reject(new Error('OpenSCAD timed out after 2 minutes'))
    }, timeoutMs)

    function handler(e: MessageEvent) {
      // Log all worker messages for debugging
      if (e.data.type === 'log') {
        console.log('[OpenSCAD Worker]', e.data.message)
        return
      }

      if (e.data.id !== id) return

      if (e.data.type === 'status') {
        onStatus?.(e.data.message)
        return
      }

      if (e.data.type === 'result') {
        cleanup()
        resolve(e.data.buffer)
        return
      }

      if (e.data.type === 'error') {
        cleanup()
        reject(new Error(e.data.message))
        return
      }
    }

    function cleanup() {
      clearTimeout(timer)
      w.removeEventListener('message', handler)
    }

    w.addEventListener('message', handler)
    w.postMessage({ id, code })
  })
}

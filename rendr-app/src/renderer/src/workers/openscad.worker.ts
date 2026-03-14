// @ts-nocheck
// OpenSCAD WASM worker - based on CADAM's approach
// https://github.com/Adam-CAD/CADAM

import OpenSCAD from '../vendor/openscad-wasm/openscad.js'
import wasmUrl from '../vendor/openscad-wasm/openscad.wasm?url'

async function createInstance() {
  return await OpenSCAD({
    noInitialRun: true,
    locateFile: (path) => {
      if (path.endsWith('.wasm')) return wasmUrl
      return path
    },
    print: (text) => self.postMessage({ type: 'log', message: '[OpenSCAD] ' + text }),
    printErr: (text) => self.postMessage({ type: 'log', message: '[OpenSCAD Error] ' + text })
  })
}

self.onmessage = async (e) => {
  const { id, code } = e.data

  try {
    self.postMessage({ id, type: 'status', message: 'Initializing OpenSCAD WASM...' })
    const inst = await createInstance()
    self.postMessage({ type: 'log', message: 'WASM instance created OK' })

    self.postMessage({ id, type: 'status', message: 'Compiling model...' })

    inst.FS.writeFile('/input.scad', code)
    self.postMessage({ type: 'log', message: 'Input file written, calling callMain...' })

    // callMain can throw a number (Emscripten exit code) on success
    let exitCode = -1
    try {
      exitCode = inst.callMain([
        '/input.scad',
        '-o', '/output.stl',
        '--export-format=binstl',
        '--enable=manifold',
        '--enable=fast-csg',
        '--enable=lazy-union'
      ])
      self.postMessage({ type: 'log', message: 'callMain returned: ' + exitCode })
    } catch (exitErr) {
      self.postMessage({ type: 'log', message: 'callMain threw: ' + typeof exitErr + ' = ' + JSON.stringify(exitErr) })
      if (typeof exitErr === 'number') {
        exitCode = exitErr
      } else if (exitErr && typeof exitErr === 'object' && 'status' in exitErr) {
        exitCode = exitErr.status
      } else {
        throw exitErr
      }
    }

    self.postMessage({ type: 'log', message: 'Exit code: ' + exitCode + ', reading output...' })

    // Try to read output
    let output
    try {
      output = inst.FS.readFile('/output.stl', { encoding: 'binary' })
      self.postMessage({ type: 'log', message: 'Output read OK, size: ' + output.length + ' bytes' })
    } catch (readErr) {
      self.postMessage({ type: 'log', message: 'Failed to read output: ' + readErr })
    }

    if (!output || output.length === 0) {
      throw new Error('OpenSCAD produced no output (exit code ' + exitCode + ')')
    }

    // Copy into a fresh ArrayBuffer (Emscripten's buffer may not be transferable)
    const copy = new Uint8Array(output).buffer
    self.postMessage({ type: 'log', message: 'Sending ' + copy.byteLength + ' bytes to main thread...' })
    self.postMessage({ id, type: 'result', buffer: copy }, [copy])
  } catch (err) {
    self.postMessage({ type: 'log', message: 'WORKER ERROR: ' + (err?.message || String(err)) })
    self.postMessage({ id, type: 'error', message: err?.message || String(err) })
  }
}

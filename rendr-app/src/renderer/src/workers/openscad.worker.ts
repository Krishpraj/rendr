// @ts-nocheck
// OpenSCAD WASM worker — exports OFF format (preserves colors) with STL fallback.

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

function tryReadFile(inst, path) {
  try {
    return inst.FS.readFile(path)
  } catch (e) {
    return null
  }
}

self.onmessage = async (e) => {
  const { id, code } = e.data

  try {
    self.postMessage({ id, type: 'status', message: 'Initializing OpenSCAD WASM...' })
    const inst = await createInstance()

    self.postMessage({ id, type: 'status', message: 'Compiling model...' })
    inst.FS.writeFile('/input.scad', code)

    // Try OFF first (has colors)
    let exitCode = -1
    try {
      exitCode = inst.callMain([
        '/input.scad',
        '-o', '/output.off',
        '--export-format=off',
        '--enable=manifold',
        '--enable=fast-csg',
        '--enable=lazy-union'
      ])
    } catch (exitErr) {
      if (typeof exitErr === 'number') exitCode = exitErr
      else if (exitErr && typeof exitErr === 'object' && 'status' in exitErr) exitCode = exitErr.status
      else throw exitErr
    }

    self.postMessage({ type: 'log', message: 'OFF export exit code: ' + exitCode })

    // Read OFF output as binary, then decode
    let offBytes = tryReadFile(inst, '/output.off')
    if (offBytes && offBytes.length > 0) {
      const offText = new TextDecoder().decode(offBytes)
      self.postMessage({ type: 'log', message: 'OFF output OK, length: ' + offText.length })
      self.postMessage({ id, type: 'result', text: offText, format: 'off' })
      return
    }

    self.postMessage({ type: 'log', message: 'OFF output empty/missing, trying STL fallback...' })

    // Fallback to STL
    const inst2 = await createInstance()
    inst2.FS.writeFile('/input.scad', code)

    let stlExitCode = -1
    try {
      stlExitCode = inst2.callMain([
        '/input.scad',
        '-o', '/output.stl',
        '--export-format=binstl',
        '--enable=manifold',
        '--enable=fast-csg',
        '--enable=lazy-union'
      ])
    } catch (exitErr) {
      if (typeof exitErr === 'number') stlExitCode = exitErr
      else if (exitErr && typeof exitErr === 'object' && 'status' in exitErr) stlExitCode = exitErr.status
      else throw exitErr
    }

    let stlBytes = tryReadFile(inst2, '/output.stl')
    if (stlBytes && stlBytes.length > 0) {
      const copy = new Uint8Array(stlBytes).buffer
      self.postMessage({ type: 'log', message: 'STL fallback OK, size: ' + copy.byteLength })
      self.postMessage({ id, type: 'result', buffer: copy, format: 'stl' }, [copy])
      return
    }

    throw new Error('OpenSCAD produced no output (OFF exit: ' + exitCode + ', STL exit: ' + stlExitCode + ')')
  } catch (err) {
    self.postMessage({ type: 'log', message: 'WORKER ERROR: ' + (err?.message || String(err)) })
    self.postMessage({ id, type: 'error', message: err?.message || String(err) })
  }
}

import * as THREE from 'three'

export interface MeshAnalytics {
  // Geometry
  vertices: number
  triangles: number
  edges: number
  // Dimensions (bounding box)
  boundingBox: {
    width: number
    height: number
    depth: number
  }
  // Physical
  surfaceArea: number
  volume: number
  centerOfMass: { x: number; y: number; z: number }
  // Topology
  isWatertight: boolean
  genus: number // topological genus (handles/holes)
}

export function analyzeMesh(geometry: THREE.BufferGeometry): MeshAnalytics {
  const position = geometry.attributes.position
  if (!position) {
    return emptyAnalytics()
  }

  const vertices = position.count
  const triangles = geometry.index
    ? Math.floor(geometry.index.count / 3)
    : Math.floor(vertices / 3)

  // Bounding box
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const size = new THREE.Vector3()
  bb.getSize(size)

  // Compute surface area, volume, and center of mass from triangles
  let surfaceArea = 0
  let volume = 0
  let cx = 0, cy = 0, cz = 0

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const cross = new THREE.Vector3()

  const getVertex = (i: number, target: THREE.Vector3) => {
    const idx = geometry.index ? geometry.index.getX(i) : i
    target.fromBufferAttribute(position, idx)
  }

  for (let i = 0; i < triangles; i++) {
    getVertex(i * 3, vA)
    getVertex(i * 3 + 1, vB)
    getVertex(i * 3 + 2, vC)

    // Surface area: half the cross product magnitude
    const ab = new THREE.Vector3().subVectors(vB, vA)
    const ac = new THREE.Vector3().subVectors(vC, vA)
    cross.crossVectors(ab, ac)
    const triArea = cross.length() * 0.5
    surfaceArea += triArea

    // Signed volume contribution (divergence theorem)
    // V = (1/6) * sum of (a . (b x c)) for each triangle
    const signedVol = vA.dot(cross) / 6.0
    volume += signedVol

    // Center of mass weighted by triangle area
    const triCx = (vA.x + vB.x + vC.x) / 3
    const triCy = (vA.y + vB.y + vC.y) / 3
    const triCz = (vA.z + vB.z + vC.z) / 3
    cx += triCx * triArea
    cy += triCy * triArea
    cz += triCz * triArea
  }

  volume = Math.abs(volume)

  if (surfaceArea > 0) {
    cx /= surfaceArea
    cy /= surfaceArea
    cz /= surfaceArea
  }

  // Edge count & watertightness check via edge map
  const edgeMap = new Map<string, number>()
  const makeEdgeKey = (a: number, b: number) => `${Math.min(a, b)}_${Math.max(a, b)}`

  for (let i = 0; i < triangles; i++) {
    const i0 = geometry.index ? geometry.index.getX(i * 3) : i * 3
    const i1 = geometry.index ? geometry.index.getX(i * 3 + 1) : i * 3 + 1
    const i2 = geometry.index ? geometry.index.getX(i * 3 + 2) : i * 3 + 2

    const edges = [makeEdgeKey(i0, i1), makeEdgeKey(i1, i2), makeEdgeKey(i2, i0)]
    for (const e of edges) {
      edgeMap.set(e, (edgeMap.get(e) || 0) + 1)
    }
  }

  const edgeCount = edgeMap.size

  // Watertight: every edge is shared by exactly 2 triangles
  let boundaryEdges = 0
  for (const count of edgeMap.values()) {
    if (count !== 2) boundaryEdges++
  }
  const isWatertight = boundaryEdges === 0

  // Euler characteristic: V - E + F = 2 - 2g (for closed manifold)
  // genus g = (2 - V + E - F) / 2
  const euler = vertices - edgeCount + triangles
  const genus = Math.max(0, Math.round((2 - euler) / 2))

  return {
    vertices,
    triangles,
    edges: edgeCount,
    boundingBox: {
      width: round2(size.x),
      height: round2(size.y),
      depth: round2(size.z)
    },
    surfaceArea: round2(surfaceArea),
    volume: round2(volume),
    centerOfMass: { x: round2(cx), y: round2(cy), z: round2(cz) },
    isWatertight,
    genus
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyAnalytics(): MeshAnalytics {
  return {
    vertices: 0,
    triangles: 0,
    edges: 0,
    boundingBox: { width: 0, height: 0, depth: 0 },
    surfaceArea: 0,
    volume: 0,
    centerOfMass: { x: 0, y: 0, z: 0 },
    isWatertight: false,
    genus: 0
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function formatSize(n: number): string {
  if (Math.abs(n) < 0.01) return '0'
  if (Math.abs(n) >= 1000) return `${(n / 10).toFixed(0)}cm`
  return `${n.toFixed(1)}mm`
}

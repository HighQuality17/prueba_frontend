import { type BufferGeometry, Mesh, Vector3 } from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { createSeededRandom } from './random'

/**
 * Samples `count` points evenly distributed across the SURFACE of a
 * BufferGeometry using Three.js's built-in MeshSurfaceSampler
 * (area-weighted triangle distribution — not random vertices,
 * not bounding-box scatter).
 *
 * Determinism: MeshSurfaceSampler calls Math.random() internally. To keep
 * output reproducible, Math.random is temporarily replaced with our seeded
 * PRNG for the duration of the sampling and restored afterwards. This is
 * contained entirely within this function call.
 */
export function generateMeshSurfacePositions(
  geometry: BufferGeometry,
  count: number,
  seed: number,
): Float32Array {
  const originalRandom = Math.random
  Math.random = createSeededRandom(seed)

  try {
    // Temporary host mesh required by the sampler; never rendered or added
    // to any scene.
    const tempMesh = new Mesh(geometry)
    const sampler = new MeshSurfaceSampler(tempMesh).build()

    const positions = new Float32Array(count * 3)
    const samplePoint = new Vector3()

    for (let i = 0; i < count; i++) {
      sampler.sample(samplePoint)
      positions[i * 3] = samplePoint.x
      positions[i * 3 + 1] = samplePoint.y
      positions[i * 3 + 2] = samplePoint.z
    }

    return positions
  } finally {
    Math.random = originalRandom
  }
}

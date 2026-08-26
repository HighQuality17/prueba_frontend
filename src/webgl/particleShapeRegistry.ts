import { TorusKnotGeometry } from 'three'
import { generateCloudPositions } from './utils/generateCloudPositions'
import { generateFibonacciPositions } from './utils/generateFibonacciPositions'
import { generateHelixPositions } from './utils/generateHelixPositions'
import { generateMeshSurfacePositions } from './utils/generateMeshSurfacePositions'
import { generateSpherePositions } from './utils/generateSpherePositions'

export type ParticleShapeId =
  | 'cloud'
  | 'fibonacci'
  | 'sphere'
  | 'helix'
  | 'torus'

export interface ParticleShape {
  positions: Float32Array
  motionAmplitude: number
  rotationAmount: number
}

export type ParticleShapeRegistry = Record<ParticleShapeId, ParticleShape>

/** Generates the CPU shape library once for a fixed particle count. */
export function createParticleShapeRegistry(
  count: number,
  seed: number,
): ParticleShapeRegistry {
  const knotGeometry = new TorusKnotGeometry(1.3, 0.38, 220, 32)
  let torusPositions: Float32Array
  try {
    torusPositions = generateMeshSurfacePositions(
      knotGeometry,
      count,
      seed + 3,
    )
  } finally {
    knotGeometry.dispose()
  }

  return {
    cloud: {
      positions: generateCloudPositions(count, seed),
      motionAmplitude: 1,
      rotationAmount: 0,
    },
    fibonacci: {
      positions: generateFibonacciPositions(count),
      motionAmplitude: 0.45,
      rotationAmount: 0.08,
    },
    sphere: {
      positions: generateSpherePositions(count, seed + 1),
      motionAmplitude: 0.35,
      rotationAmount: 0,
    },
    helix: {
      positions: generateHelixPositions(count, seed + 2),
      motionAmplitude: 0.6,
      rotationAmount: 1,
    },
    torus: {
      positions: torusPositions,
      motionAmplitude: 0.4,
      rotationAmount: 0.15,
    },
  }
}

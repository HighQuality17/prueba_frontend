import type { ParticleShapeId } from '../particleShapeRegistry'

export interface JourneyRange {
  readonly start: number
  readonly end: number
}

export interface ParticleMorph extends JourneyRange {
  readonly from: ParticleShapeId
  readonly to: ParticleShapeId
}

/*
  Central timing map for the current journey. The document's normalized
  scroll progress is mapped through these ranges by individual visual systems.
*/
export const journeyPhases = {
  cloudToSphere: { start: 0, end: 0.309 },
  sphereHold: { start: 0.309, end: 0.364 },
  sphereToHelix: { start: 0.364, end: 0.636 },
  helixHold: { start: 0.636, end: 0.691 },
  helixToTorus: { start: 0.691, end: 0.982 },
  torusHold: { start: 0.982, end: 1 },
} as const satisfies Record<string, JourneyRange>

export const particleMorphs = [
  {
    ...journeyPhases.cloudToSphere,
    from: 'cloud',
    to: 'sphere',
  },
  {
    ...journeyPhases.sphereToHelix,
    from: 'sphere',
    to: 'helix',
  },
  {
    ...journeyPhases.helixToTorus,
    from: 'helix',
    to: 'torus',
  },
] as const satisfies readonly ParticleMorph[]

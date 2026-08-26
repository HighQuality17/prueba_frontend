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
  cloudToFibonacci: { start: 0, end: 0.21 },
  fibonacciHold: { start: 0.21, end: 0.26 },
  fibonacciToSphere: { start: 0.26, end: 0.42 },
  sphereHold: { start: 0.42, end: 0.47 },
  sphereToHelix: { start: 0.47, end: 0.65 },
  helixHold: { start: 0.65, end: 0.7 },
  helixToTorus: { start: 0.7, end: 0.96 },
  torusHold: { start: 0.96, end: 1 },
} as const satisfies Record<string, JourneyRange>

export const particleMorphs = [
  {
    ...journeyPhases.cloudToFibonacci,
    from: 'cloud',
    to: 'fibonacci',
  },
  {
    ...journeyPhases.fibonacciToSphere,
    from: 'fibonacci',
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

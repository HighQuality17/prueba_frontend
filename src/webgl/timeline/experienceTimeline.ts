import type { ParticleShapeId } from '../particleShapeRegistry'

export interface JourneyRange {
  readonly start: number
  readonly end: number
}

export interface ParticleMorph extends JourneyRange {
  readonly from: ParticleShapeId
  readonly to: ParticleShapeId
}

export interface RadialScaleEffect extends JourneyRange {
  readonly amplitude: number
}

/*
  Central timing map for the current journey. The document's normalized
  scroll progress is mapped through these ranges by individual visual systems.
*/
export const journeyPhases = {
  cloudToFibonacci: { start: 0, end: 0.18 },
  fibonacciSettle: { start: 0.18, end: 0.22 },
  fibonacciEffectHold: { start: 0.22, end: 0.36 },
  fibonacciToSphere: { start: 0.36, end: 0.48 },
  sphereHold: { start: 0.48, end: 0.52 },
  sphereToHelix: { start: 0.52, end: 0.68 },
  helixHold: { start: 0.68, end: 0.72 },
  helixToTorus: { start: 0.72, end: 0.96 },
  torusHold: { start: 0.96, end: 1 },
} as const satisfies Record<string, JourneyRange>

export const particleEffects = {
  fibonacciBreath: {
    ...journeyPhases.fibonacciEffectHold,
    amplitude: 0.6,
  },
} as const satisfies Record<string, RadialScaleEffect>

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

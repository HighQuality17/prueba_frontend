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

export interface ProceduralDistortionEffect extends JourneyRange {
  readonly maxStrength: number
}

/*
  Central timing map for the current journey. The document's normalized
  scroll progress is mapped through these ranges by individual visual systems.
*/
export const journeyPhases = {
  cloudToFibonacci: { start: 0, end: 0.17 },
  fibonacciSettle: { start: 0.17, end: 0.21 },
  fibonacciEffectHold: { start: 0.21, end: 0.33 },
  fibonacciToSphere: { start: 0.33, end: 0.44 },
  sphereSettle: { start: 0.44, end: 0.47 },
  sphereDistortionHold: { start: 0.47, end: 0.62 },
  sphereRecovery: { start: 0.62, end: 0.65 },
  sphereToHelix: { start: 0.65, end: 0.77 },
  helixHold: { start: 0.77, end: 0.8 },
  helixToTorus: { start: 0.8, end: 0.97 },
  torusHold: { start: 0.97, end: 1 },
} as const satisfies Record<string, JourneyRange>

export const particleEffects = {
  fibonacciBreath: {
    ...journeyPhases.fibonacciEffectHold,
    amplitude: 0.6,
  },
  sphereFractalDistortion: {
    ...journeyPhases.sphereDistortionHold,
    maxStrength: 0.75,
  },
} as const satisfies Record<
  string,
  RadialScaleEffect | ProceduralDistortionEffect
>

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

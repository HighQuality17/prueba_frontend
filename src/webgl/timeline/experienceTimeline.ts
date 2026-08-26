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

export interface SingularityEffect extends JourneyRange {
  readonly minimumScale: number
  readonly maxBurstDistance: number
  readonly expandedBurstRatio: number
  readonly maxTurbulence: number
  readonly stages: {
    readonly implosion: JourneyRange
    readonly charge: JourneyRange
    readonly explosion: JourneyRange
    readonly turbulence: JourneyRange
    readonly reassembly: JourneyRange
  }
}

/*
  Central timing map for the current journey. The document's normalized
  scroll progress is mapped through these ranges by individual visual systems.
*/
export const journeyPhases = {
  cloudToFibonacci: { start: 0, end: 0.15 },
  fibonacciSettle: { start: 0.15, end: 0.18 },
  fibonacciEffectHold: { start: 0.18, end: 0.28 },
  fibonacciToSphere: { start: 0.28, end: 0.38 },
  sphereSettle: { start: 0.38, end: 0.41 },
  sphereDistortionHold: { start: 0.41, end: 0.53 },
  sphereRecovery: { start: 0.53, end: 0.56 },
  sphereSingularityHold: { start: 0.56, end: 0.72 },
  sphereSilence: { start: 0.72, end: 0.75 },
  sphereToHelix: { start: 0.75, end: 0.84 },
  helixHold: { start: 0.84, end: 0.86 },
  helixToTorus: { start: 0.86, end: 0.98 },
  torusHold: { start: 0.98, end: 1 },
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
  singularityBurst: {
    ...journeyPhases.sphereSingularityHold,
    minimumScale: 0.08,
    maxBurstDistance: 2.4,
    expandedBurstRatio: 0.86,
    maxTurbulence: 0.42,
    stages: {
      implosion: { start: 0, end: 0.28 },
      charge: { start: 0.28, end: 0.38 },
      explosion: { start: 0.38, end: 0.62 },
      turbulence: { start: 0.62, end: 0.8 },
      reassembly: { start: 0.8, end: 1 },
    },
  },
} as const satisfies Record<
  string,
  RadialScaleEffect | ProceduralDistortionEffect | SingularityEffect
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

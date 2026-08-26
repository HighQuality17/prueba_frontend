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
  Phase 14: the restore stage was replaced by a darkHold that extends to the
  end of the journey. The ProceduralTunnel owns the screen after the portal,
  so particles stay dark; legacy helix/torus morphs still run behind it.
  Scrolling back above fadeOut.start restores particles deterministically.
*/
export interface PortalFadeEffect extends JourneyRange {
  readonly minimumOpacity: number
  readonly stages: {
    readonly fadeOut: JourneyRange
    readonly darkHold: JourneyRange
  }
}

export interface TunnelEffect extends JourneyRange {
  readonly maxTravelDistance: number
  readonly symmetryFrom: number
  readonly symmetryTo: number
  readonly twistFrom: number
  readonly twistTo: number
  /** Portion of the range spent opening the radial portal aperture. */
  readonly revealFraction: number
}

export interface TunnelBloomEffect extends JourneyRange {
  readonly openingIntensity: number
  readonly maxIntensity: number
  readonly stages: {
    readonly opening: JourneyRange
    readonly travel: JourneyRange
  }
}

export interface CameraDiveEffect extends JourneyRange {
  readonly stages: {
    readonly stillness: JourneyRange
    readonly approach: JourneyRange
    readonly acceleration: JourneyRange
    readonly passThrough: JourneyRange
    readonly settle: JourneyRange
  }
}

/*
  Central timing map for the current journey. The document's normalized
  scroll progress is mapped through these ranges by individual visual systems.
*/
export const journeyPhases = {
  cloudToFibonacci: { start: 0, end: 0.14 },
  fibonacciSettle: { start: 0.14, end: 0.17 },
  fibonacciEffectHold: { start: 0.17, end: 0.27 },
  fibonacciToSphere: { start: 0.27, end: 0.36 },
  sphereSettle: { start: 0.36, end: 0.39 },
  sphereDistortionHold: { start: 0.39, end: 0.49 },
  sphereDistortionRecovery: { start: 0.49, end: 0.52 },
  sphereSingularityHold: { start: 0.52, end: 0.67 },
  sphereRecovery: { start: 0.67, end: 0.7 },
  portalDive: { start: 0.7, end: 0.84 },
  transitionSilence: { start: 0.84, end: 0.87 },
  sphereToHelix: { start: 0.87, end: 0.925 },
  helixHold: { start: 0.925, end: 0.94 },
  helixToTorus: { start: 0.94, end: 0.99 },
  torusHold: { start: 0.99, end: 1 },
} as const satisfies Record<string, JourneyRange>

export const cameraEffects = {
  portalDive: {
    ...journeyPhases.portalDive,
    stages: {
      stillness: { start: 0, end: 0.15 },
      approach: { start: 0.15, end: 0.45 },
      acceleration: { start: 0.45, end: 0.72 },
      passThrough: { start: 0.72, end: 0.9 },
      settle: { start: 0.9, end: 1 },
    },
  },
} as const satisfies Record<string, CameraDiveEffect>

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
  portalFade: {
    start: journeyPhases.portalDive.end - 0.02,
    end: 1,
    minimumOpacity: 0.015,
    stages: {
      // Crossfades against the tunnel reveal, which begins at the same point.
      fadeOut: { start: 0.82, end: 0.875 },
      darkHold: { start: 0.875, end: 1 },
    },
  },
} as const satisfies Record<
  string,
  | RadialScaleEffect
  | ProceduralDistortionEffect
  | SingularityEffect
  | PortalFadeEffect
>

/*
  Phase 14 world systems. The tunnel starts during the final camera dive so
  its reveal overlaps the particle fade-out instead of cutting from black.
*/
export const worldEffects = {
  tunnel: {
    start: 0.82,
    end: 1,
    maxTravelDistance: 26,
    symmetryFrom: 6,
    symmetryTo: 12,
    twistFrom: 0.14,
    twistTo: 0.52,
    revealFraction: 0.3,
  },
} as const satisfies Record<string, TunnelEffect>

const TUNNEL_REVEAL_END =
  worldEffects.tunnel.start +
  (worldEffects.tunnel.end - worldEffects.tunnel.start) *
    worldEffects.tunnel.revealFraction

export const postEffects = {
  tunnelBloom: {
    start: worldEffects.tunnel.start,
    end: worldEffects.tunnel.end,
    openingIntensity: 0.24,
    maxIntensity: 0.68,
    stages: {
      opening: {
        start: worldEffects.tunnel.start,
        end: TUNNEL_REVEAL_END,
      },
      travel: {
        start: TUNNEL_REVEAL_END,
        end: worldEffects.tunnel.end,
      },
    },
  },
} as const satisfies Record<string, TunnelBloomEffect>

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

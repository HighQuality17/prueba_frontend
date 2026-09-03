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

export interface OrganicMetamorphosisEffect extends JourneyRange {
  readonly maxAsymmetry: number
  readonly idleAmplitude: number
  readonly idleCycleSeconds: number
  readonly stages: {
    readonly hints: JourneyRange
    readonly cellular: JourneyRange
    readonly livingCore: JourneyRange
  }
}

export interface EyeEmergenceEffect extends JourneyRange {
  readonly stages: {
    readonly iris: JourneyRange
    readonly pupil: JourneyRange
    readonly glint: JourneyRange
    readonly openHold: JourneyRange
    readonly blinkClose: JourneyRange
    readonly blinkReopen: JourneyRange
    readonly reopenedHold: JourneyRange
    readonly emergence: JourneyRange
  }
}

export interface LifeSeedEffect extends JourneyRange {
  readonly initialScale: number
  readonly finalScale: number
  readonly forwardDistance: number
  readonly verticalLift: number
  readonly pulseAmplitude: number
  readonly stages: {
    readonly handoff: JourneyRange
    readonly detachment: JourneyRange
    readonly backgroundFade: JourneyRange
    readonly suspension: JourneyRange
    readonly pulse: JourneyRange
    readonly anticipation: JourneyRange
  }
}

export interface SeedGerminationEffect extends JourneyRange {
  readonly stages: {
    readonly activation: JourneyRange
    readonly tension: JourneyRange
    readonly opening: JourneyRange
    readonly coreReveal: JourneyRange
    readonly filaments: JourneyRange
    readonly openedHold: JourneyRange
  }
}

export interface LifeNetworkEffect extends JourneyRange {
  readonly stages: {
    readonly primaryBranches: JourneyRange
    readonly bifurcations: JourneyRange
    readonly nodes: JourneyRange
    readonly connections: JourneyRange
    readonly energyPulse: JourneyRange
    readonly stableHold: JourneyRange
  }
}

export interface FirstLifeformEffect extends JourneyRange {
  readonly stages: {
    readonly nodeActivation: JourneyRange
    readonly energyTransfer: JourneyRange
    readonly bellFormation: JourneyRange
    readonly tentacleGrowth: JourneyRange
    readonly detachment: JourneyRange
    readonly connectionRelease: JourneyRange
    readonly contraction: JourneyRange
    readonly freeHold: JourneyRange
  }
}

export interface MedusaAwakeningEffect extends JourneyRange {
  readonly stages: {
    readonly awakening: JourneyRange
    readonly secondContraction: JourneyRange
    readonly swimmingImpulse: JourneyRange
    readonly drift: JourneyRange
    readonly ecosystemProximity: JourneyRange
    readonly networkResponse: JourneyRange
    readonly energyExchange: JourneyRange
    readonly stableHold: JourneyRange
  }
}

export interface SacredGeometryEffect extends JourneyRange {
  readonly stages: {
    readonly birth: JourneyRange
    readonly eyeIntegration: JourneyRange
    readonly expansion: JourneyRange
    readonly fullBloom: JourneyRange
    readonly tiger: JourneyRange
    readonly serpent: JourneyRange
    readonly eagle: JourneyRange
    readonly finalHold: JourneyRange
  }
}

export interface TunnelBloomEffect extends JourneyRange {
  readonly openingIntensity: number
  readonly maxIntensity: number
  readonly lifeIntensity: number
  readonly stages: {
    readonly opening: JourneyRange
    readonly travel: JourneyRange
    readonly lifeTransition: JourneyRange
  }
}

export interface ChromaticAberrationTimeline extends JourneyRange {
  readonly introOffset: number
  readonly middleOffset: number
  readonly maxOffset: number
  readonly endOffset: number
  readonly lifeOffset: number
  readonly directionFrom: number
  readonly directionTo: number
  readonly stages: {
    readonly intro: JourneyRange
    readonly build: JourneyRange
    readonly peak: JourneyRange
    readonly settle: JourneyRange
    readonly lifeFade: JourneyRange
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

export const PHASE_22_JOURNEY_END = 0.84
export const PHASE_21_JOURNEY_END = 0.84 * PHASE_22_JOURNEY_END
export const PHASE_20_JOURNEY_END = 0.84 * PHASE_21_JOURNEY_END
export const PHASE_19_JOURNEY_END = 0.84 * PHASE_20_JOURNEY_END
export const LEGACY_JOURNEY_END = 0.84 * PHASE_19_JOURNEY_END

function phase22Range(start: number, end: number): JourneyRange {
  return {
    start: start * PHASE_22_JOURNEY_END,
    end: end * PHASE_22_JOURNEY_END,
  }
}

function phase21Range(start: number, end: number): JourneyRange {
  return {
    start: start * PHASE_21_JOURNEY_END,
    end: end * PHASE_21_JOURNEY_END,
  }
}

function phase20Range(start: number, end: number): JourneyRange {
  return {
    start: start * PHASE_20_JOURNEY_END,
    end: end * PHASE_20_JOURNEY_END,
  }
}

function approvedRange(start: number, end: number): JourneyRange {
  return {
    start: start * PHASE_19_JOURNEY_END,
    end: end * PHASE_19_JOURNEY_END,
  }
}

function legacyRange(start: number, end: number): JourneyRange {
  return {
    start: start * LEGACY_JOURNEY_END,
    end: end * LEGACY_JOURNEY_END,
  }
}

export const journeyActs = {
  order: legacyRange(0, 0.52),
  breakdown: legacyRange(0.52, 0.7),
  beyond: legacyRange(0.7, 1),
  life: { start: LEGACY_JOURNEY_END, end: 1 },
} as const satisfies Record<string, JourneyRange>

/* Approved pre-LIFE timings retain their physical scroll duration. */
export const journeyPhases = {
  cloudToFibonacci: legacyRange(0, 0.14),
  fibonacciSettle: legacyRange(0.14, 0.17),
  fibonacciEffectHold: legacyRange(0.17, 0.27),
  fibonacciToSphere: legacyRange(0.27, 0.36),
  sphereSettle: legacyRange(0.36, 0.39),
  sphereDistortionHold: legacyRange(0.39, 0.49),
  sphereDistortionRecovery: legacyRange(0.49, 0.52),
  sphereSingularityHold: legacyRange(0.52, 0.67),
  sphereRecovery: legacyRange(0.67, 0.7),
  portalDive: legacyRange(0.7, 0.84),
  transitionSilence: legacyRange(0.84, 0.87),
  sphereToHelix: legacyRange(0.87, 0.925),
  helixHold: legacyRange(0.925, 0.94),
  helixToTorus: legacyRange(0.94, 0.99),
  torusHold: legacyRange(0.99, 1),
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
    ...legacyRange(0.82, 1),
    minimumOpacity: 0.015,
    stages: {
      // Crossfades against the tunnel reveal, which begins at the same point.
      fadeOut: legacyRange(0.82, 0.875),
      darkHold: legacyRange(0.875, 1),
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
    ...legacyRange(0.82, 1),
    maxTravelDistance: 26,
    symmetryFrom: 6,
    symmetryTo: 12,
    twistFrom: 0.14,
    twistTo: 0.52,
    revealFraction: 0.3,
  },
  organicMetamorphosis: {
    ...legacyRange(0.88, 1),
    maxAsymmetry: 0.07,
    idleAmplitude: 0.012,
    idleCycleSeconds: 32,
    stages: {
      hints: legacyRange(0.88, 0.92),
      cellular: legacyRange(0.92, 0.96),
      livingCore: legacyRange(0.92, 0.96),
    },
  },
  eyeEmergence: {
    ...legacyRange(0.96, 1),
    stages: {
      iris: legacyRange(0.96, 0.976),
      pupil: legacyRange(0.966, 0.978),
      glint: legacyRange(0.972, 0.978),
      openHold: legacyRange(0.978, 0.983),
      blinkClose: legacyRange(0.983, 0.989),
      blinkReopen: legacyRange(0.989, 0.994),
      reopenedHold: legacyRange(0.994, 0.997),
      emergence: legacyRange(0.997, 1),
    },
  },
  sacredGeometry: {
    start: legacyRange(0.997, 1).start,
    end: 1,
    stages: {
      // The first diagram appears during the approved eye's final emergence.
      birth: { start: legacyRange(0.997, 1).start, end: 0.475 },
      eyeIntegration: { start: LEGACY_JOURNEY_END, end: 0.5 },
      expansion: { start: 0.445, end: 0.61 },
      fullBloom: { start: 0.565, end: 0.7 },
      tiger: { start: 0.68, end: 0.8 },
      serpent: { start: 0.78, end: 0.9 },
      eagle: { start: 0.88, end: 0.98 },
      finalHold: { start: 0.97, end: 1 },
    },
  },
  lifeSeed: {
    ...approvedRange(0.84, 1),
    initialScale: 0.072,
    finalScale: 0.2,
    forwardDistance: 1.45,
    verticalLift: 0.16,
    pulseAmplitude: 0.04,
    stages: {
      handoff: approvedRange(0.84, 0.855),
      detachment: approvedRange(0.84, 0.9),
      backgroundFade: approvedRange(0.855, 0.93),
      suspension: approvedRange(0.93, 0.965),
      pulse: approvedRange(0.965, 0.985),
      anticipation: approvedRange(0.985, 1),
    },
  },
  seedGermination: {
    ...phase20Range(0.84, 1),
    stages: {
      activation: phase20Range(0.84, 0.87),
      tension: phase20Range(0.87, 0.9),
      opening: phase20Range(0.9, 0.95),
      coreReveal: phase20Range(0.92, 0.965),
      filaments: phase20Range(0.95, 0.985),
      openedHold: phase20Range(0.985, 1),
    },
  },
  lifeNetwork: {
    ...phase21Range(0.84, 1),
    stages: {
      primaryBranches: phase21Range(0.84, 0.89),
      bifurcations: phase21Range(0.88, 0.93),
      nodes: phase21Range(0.92, 0.955),
      connections: phase21Range(0.94, 0.97),
      energyPulse: phase21Range(0.97, 0.992),
      stableHold: phase21Range(0.992, 1),
    },
  },
  firstLifeform: {
    ...phase22Range(0.84, 1),
    stages: {
      nodeActivation: phase22Range(0.84, 0.865),
      energyTransfer: phase22Range(0.845, 0.88),
      bellFormation: phase22Range(0.865, 0.91),
      tentacleGrowth: phase22Range(0.895, 0.94),
      detachment: phase22Range(0.92, 0.97),
      connectionRelease: phase22Range(0.955, 0.98),
      contraction: phase22Range(0.97, 0.992),
      freeHold: phase22Range(0.992, 1),
    },
  },
  medusaAwakening: {
    start: PHASE_22_JOURNEY_END,
    end: 1,
    stages: {
      awakening: { start: 0.84, end: 0.865 },
      secondContraction: { start: 0.855, end: 0.89 },
      swimmingImpulse: { start: 0.875, end: 0.92 },
      drift: { start: 0.91, end: 0.95 },
      ecosystemProximity: { start: 0.94, end: 0.965 },
      networkResponse: { start: 0.95, end: 0.978 },
      energyExchange: { start: 0.968, end: 0.99 },
      stableHold: { start: 0.99, end: 1 },
    },
  },
} as const satisfies Record<
  string,
  | TunnelEffect
  | OrganicMetamorphosisEffect
  | EyeEmergenceEffect
  | SacredGeometryEffect
  | LifeSeedEffect
  | SeedGerminationEffect
  | LifeNetworkEffect
  | FirstLifeformEffect
  | MedusaAwakeningEffect
>

const TUNNEL_REVEAL_END =
  worldEffects.tunnel.start +
  (worldEffects.tunnel.end - worldEffects.tunnel.start) *
    worldEffects.tunnel.revealFraction

export const postEffects = {
  tunnelBloom: {
    start: worldEffects.tunnel.start,
    end: journeyActs.life.end,
    openingIntensity: 0.24,
    maxIntensity: 0.68,
    lifeIntensity: 0.46,
    stages: {
      opening: {
        start: worldEffects.tunnel.start,
        end: TUNNEL_REVEAL_END,
      },
      travel: {
        start: TUNNEL_REVEAL_END,
        end: worldEffects.tunnel.end,
      },
      lifeTransition: approvedRange(0.84, 0.94),
    },
  },
  chromaticAberration: {
    start: worldEffects.tunnel.start,
    end: journeyActs.life.end,
    introOffset: 0.00006,
    middleOffset: 0.00025,
    maxOffset: 0.00062,
    endOffset: 0.00048,
    lifeOffset: 0.00008,
    directionFrom: 0.35,
    directionTo: -0.18,
    stages: {
      intro: legacyRange(0.82, 0.88),
      build: legacyRange(0.88, 0.93),
      peak: legacyRange(0.93, 0.97),
      settle: legacyRange(0.97, 1),
      lifeFade: approvedRange(0.84, 0.92),
    },
  },
} as const satisfies Record<
  string,
  TunnelBloomEffect | ChromaticAberrationTimeline
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

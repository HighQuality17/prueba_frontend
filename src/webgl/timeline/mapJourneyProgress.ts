import type {
  ChromaticAberrationTimeline,
  JourneyRange,
  PortalFadeEffect,
  SingularityEffect,
  TunnelBloomEffect,
} from './experienceTimeline'

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function mapRange(
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number,
): number {
  if (inputStart === inputEnd) return outputEnd

  const progress = clamp01((value - inputStart) / (inputEnd - inputStart))
  return outputStart + progress * (outputEnd - outputStart)
}

export function segmentProgress(
  journeyProgress: number,
  range: JourneyRange,
): number {
  return mapRange(journeyProgress, range.start, range.end, 0, 1)
}

export function sineCycle(progress: number): number {
  const normalized = clamp01(progress)
  if (normalized === 0 || normalized === 1) return 0
  return Math.sin(normalized * Math.PI * 2)
}

export function sineSquaredEnvelope(progress: number): number {
  const normalized = clamp01(progress)
  if (normalized === 0 || normalized === 1) return 0
  const sine = Math.sin(normalized * Math.PI)
  return sine * sine
}

export function smoothstep01(value: number): number {
  const normalized = clamp01(value)
  return normalized * normalized * (3 - 2 * normalized)
}

export function smootherstep01(value: number): number {
  const normalized = clamp01(value)
  return (
    normalized *
    normalized *
    normalized *
    (normalized * (normalized * 6 - 15) + 10)
  )
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function portalParticleOpacity(
  journeyProgress: number,
  effect: PortalFadeEffect,
): number {
  const { fadeOut } = effect.stages

  if (journeyProgress <= fadeOut.start) return 1
  if (journeyProgress < fadeOut.end) {
    return mix(
      1,
      effect.minimumOpacity,
      smootherstep01(segmentProgress(journeyProgress, fadeOut)),
    )
  }
  return effect.minimumOpacity
}

export function tunnelBloomIntensity(
  journeyProgress: number,
  effect: TunnelBloomEffect,
): number {
  const { opening, travel, lifeTransition } = effect.stages

  if (journeyProgress <= opening.start) return 0
  if (journeyProgress < opening.end) {
    return mix(
      0,
      effect.openingIntensity,
      smootherstep01(segmentProgress(journeyProgress, opening)),
    )
  }

  if (journeyProgress < travel.end) {
    return mix(
      effect.openingIntensity,
      effect.maxIntensity,
      smootherstep01(segmentProgress(journeyProgress, travel)),
    )
  }

  return mix(
    effect.maxIntensity,
    effect.lifeIntensity,
    smootherstep01(segmentProgress(journeyProgress, lifeTransition)),
  )
}

export function chromaticAberrationOffset(
  journeyProgress: number,
  effect: ChromaticAberrationTimeline,
): number {
  const { intro, build, peak, settle, lifeFade } = effect.stages

  if (journeyProgress <= intro.start) return 0
  if (journeyProgress < intro.end) {
    return mix(
      0,
      effect.introOffset,
      smootherstep01(segmentProgress(journeyProgress, intro)),
    )
  }
  if (journeyProgress < build.end) {
    return mix(
      effect.introOffset,
      effect.middleOffset,
      smootherstep01(segmentProgress(journeyProgress, build)),
    )
  }
  if (journeyProgress < peak.end) {
    return mix(
      effect.middleOffset,
      effect.maxOffset,
      smootherstep01(segmentProgress(journeyProgress, peak)),
    )
  }

  if (journeyProgress < settle.end) {
    return mix(
      effect.maxOffset,
      effect.endOffset,
      smootherstep01(segmentProgress(journeyProgress, settle)),
    )
  }

  return mix(
    effect.endOffset,
    effect.lifeOffset,
    smootherstep01(segmentProgress(journeyProgress, lifeFade)),
  )
}

export function chromaticAberrationDirection(
  journeyProgress: number,
  effect: ChromaticAberrationTimeline,
): number {
  return mix(
    effect.directionFrom,
    effect.directionTo,
    smootherstep01(segmentProgress(journeyProgress, {
      start: effect.start,
      end: effect.stages.settle.end,
    })),
  )
}

export function singularityRadialScale(
  progress: number,
  effect: SingularityEffect,
): number {
  const { implosion, charge, explosion } = effect.stages

  if (progress <= implosion.end) {
    return mix(
      1,
      effect.minimumScale,
      smootherstep01(segmentProgress(progress, implosion)),
    )
  }
  if (progress < charge.end) return effect.minimumScale
  if (progress < explosion.end) {
    return mix(
      effect.minimumScale,
      1,
      smootherstep01(segmentProgress(progress, explosion)),
    )
  }
  return 1
}

export function singularityBurstDistance(
  progress: number,
  effect: SingularityEffect,
): number {
  const { explosion, turbulence, reassembly } = effect.stages

  if (progress <= explosion.start) return 0
  if (progress < explosion.end) {
    return (
      effect.maxBurstDistance *
      smootherstep01(segmentProgress(progress, explosion))
    )
  }
  if (progress < turbulence.end) {
    return mix(
      effect.maxBurstDistance,
      effect.maxBurstDistance * effect.expandedBurstRatio,
      smoothstep01(segmentProgress(progress, turbulence)),
    )
  }
  if (progress < reassembly.end) {
    return (
      effect.maxBurstDistance *
      effect.expandedBurstRatio *
      (1 - smootherstep01(segmentProgress(progress, reassembly)))
    )
  }
  return 0
}

export function singularityScatter(
  progress: number,
  effect: SingularityEffect,
): number {
  const { explosion, turbulence, reassembly } = effect.stages

  if (progress <= explosion.start) return 0
  if (progress < explosion.end) {
    return 0.78 * smootherstep01(segmentProgress(progress, explosion))
  }
  if (progress < turbulence.end) {
    return mix(
      0.78,
      1,
      smoothstep01(segmentProgress(progress, turbulence)),
    )
  }
  if (progress < reassembly.end) {
    return 1 - smootherstep01(segmentProgress(progress, reassembly))
  }
  return 0
}

export function singularitySwirl(
  progress: number,
  effect: SingularityEffect,
): number {
  const { implosion, charge, explosion, turbulence, reassembly } =
    effect.stages

  if (progress <= implosion.end) {
    return 0.75 * smootherstep01(segmentProgress(progress, implosion))
  }
  if (progress < charge.end) {
    return mix(
      0.75,
      1,
      smoothstep01(segmentProgress(progress, charge)),
    )
  }
  if (progress < explosion.end) {
    return mix(
      1,
      0.35,
      smoothstep01(segmentProgress(progress, explosion)),
    )
  }
  if (progress < turbulence.end) {
    return mix(
      0.35,
      0.12,
      smoothstep01(segmentProgress(progress, turbulence)),
    )
  }
  if (progress < reassembly.end) {
    return 0.12 * (1 - smootherstep01(segmentProgress(progress, reassembly)))
  }
  return 0
}

export function singularityTurbulence(
  progress: number,
  effect: SingularityEffect,
): number {
  const { explosion, turbulence, reassembly } = effect.stages

  if (progress <= explosion.start) return 0
  if (progress < explosion.end) {
    return (
      effect.maxTurbulence *
      0.35 *
      smoothstep01(segmentProgress(progress, explosion))
    )
  }
  if (progress < turbulence.end) {
    return mix(
      effect.maxTurbulence * 0.35,
      effect.maxTurbulence,
      smoothstep01(segmentProgress(progress, turbulence)),
    )
  }
  if (progress < reassembly.end) {
    return (
      effect.maxTurbulence *
      (1 - smootherstep01(segmentProgress(progress, reassembly)))
    )
  }
  return 0
}

export function singularityEnergy(
  progress: number,
  effect: SingularityEffect,
): number {
  const { implosion, charge, explosion, turbulence, reassembly } =
    effect.stages

  if (progress <= implosion.end) {
    return 0.8 * smootherstep01(segmentProgress(progress, implosion))
  }
  if (progress < charge.end) {
    return mix(
      0.8,
      1,
      smoothstep01(segmentProgress(progress, charge)),
    )
  }
  if (progress < explosion.end) {
    return mix(
      1,
      0.3,
      smoothstep01(segmentProgress(progress, explosion)),
    )
  }
  if (progress < turbulence.end) {
    return mix(
      0.3,
      0.1,
      smoothstep01(segmentProgress(progress, turbulence)),
    )
  }
  if (progress < reassembly.end) {
    return 0.1 * (1 - smootherstep01(segmentProgress(progress, reassembly)))
  }
  return 0
}

export function activeSegmentIndex(
  journeyProgress: number,
  segments: readonly JourneyRange[],
): number {
  let activeIndex = 0

  for (let i = 1; i < segments.length; i++) {
    if (journeyProgress < segments[i].start) break
    activeIndex = i
  }

  return activeIndex
}

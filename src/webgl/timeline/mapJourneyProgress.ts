import type { JourneyRange } from './experienceTimeline'

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

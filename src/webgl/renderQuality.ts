export interface RenderQualityProfile {
  readonly isMobile: boolean
  readonly tunnelDpr: number
  readonly tunnelSteps: number
  readonly tunnelDetail: number
  readonly bloomMipmap: boolean
  readonly bloomLevels: number
  readonly bloomResolutionScale: number
}

const DESKTOP_PROFILE: RenderQualityProfile = {
  isMobile: false,
  tunnelDpr: 1.75,
  tunnelSteps: 64,
  tunnelDetail: 1,
  bloomMipmap: true,
  bloomLevels: 5,
  bloomResolutionScale: 0.5,
}

const MOBILE_PROFILE: RenderQualityProfile = {
  isMobile: true,
  tunnelDpr: 1.15,
  tunnelSteps: 28,
  tunnelDetail: 0,
  bloomMipmap: false,
  bloomLevels: 0,
  bloomResolutionScale: 0.35,
}

interface NavigatorDeviceSignals extends Navigator {
  readonly deviceMemory?: number
}

export function detectRenderQuality(): RenderQualityProfile {
  if (typeof window === 'undefined') return DESKTOP_PROFILE

  const navigatorWithSignals = navigator as NavigatorDeviceSignals
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const anyCoarsePointer = window.matchMedia('(any-pointer: coarse)').matches
  const touchPoints = navigator.maxTouchPoints ?? 0
  const memory = navigatorWithSignals.deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 8
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 768
  const constrainedDevice = memory <= 4 || cores <= 4
  const isMobile =
    coarsePointer ||
    (anyCoarsePointer && touchPoints > 0 && (compactViewport || constrainedDevice))

  return isMobile ? MOBILE_PROFILE : DESKTOP_PROFILE
}

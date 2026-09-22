export interface RenderQualityProfile {
  readonly name: 'desktop' | 'mobile-economy'
  readonly isMobile: boolean
  readonly tunnelAngularSegments: number
  readonly tunnelCrossSegments: number
  readonly tunnelCells: number
  readonly tunnelLayers: number
  readonly tunnelDetail: number
  readonly bloomEnabled: boolean
  readonly bloomMipmap: boolean
  readonly bloomLevels: number
  readonly bloomResolutionScale: number
  readonly chromaticAberrationEnabled: boolean
}

const DESKTOP_PROFILE: RenderQualityProfile = {
  name: 'desktop',
  isMobile: false,
  tunnelAngularSegments: 192,
  tunnelCrossSegments: 8,
  tunnelCells: 28,
  tunnelLayers: 4,
  tunnelDetail: 1,
  bloomEnabled: true,
  bloomMipmap: true,
  bloomLevels: 4,
  bloomResolutionScale: 0.5,
  chromaticAberrationEnabled: true,
}

const MOBILE_PROFILE: RenderQualityProfile = {
  name: 'mobile-economy',
  isMobile: true,
  tunnelAngularSegments: 96,
  tunnelCrossSegments: 6,
  tunnelCells: 18,
  tunnelLayers: 3,
  tunnelDetail: 0,
  bloomEnabled: false,
  bloomMipmap: false,
  bloomLevels: 0,
  bloomResolutionScale: 0.35,
  chromaticAberrationEnabled: false,
}

interface NavigatorDeviceSignals extends Navigator {
  readonly deviceMemory?: number
}

export function detectRenderQuality(): RenderQualityProfile {
  if (typeof window === 'undefined') return DESKTOP_PROFILE

  const query = new URLSearchParams(window.location.search)
  if (query.get('forceMobileEconomy') === '1') return MOBILE_PROFILE

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

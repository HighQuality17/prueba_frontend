import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { HalfFloatType, Vector2 } from 'three'
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing'
import { postEffects } from '../timeline/experienceTimeline'
import {
  chromaticAberrationDirection,
  chromaticAberrationOffset,
  tunnelBloomIntensity,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'

const BLOOM_LUMINANCE_THRESHOLD = 1.1
const BLOOM_LUMINANCE_SMOOTHING = 0.08
const BLOOM_RADIUS = 0.72
const BLOOM_MIP_LEVELS = 5
const ABERRATION_MODULATION_OFFSET = 0.22
const MOBILE_BREAKPOINT = 768

interface JourneyPostProcessingProps {
  journeyProgress: JourneyProgressRef
}

function JourneyBloomPass({
  journeyProgress,
}: JourneyPostProcessingProps) {
  const camera = useThree((state) => state.camera)
  const [bloom, bloomPass] = useMemo(() => {
    const effect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      intensity: 0,
      luminanceThreshold: BLOOM_LUMINANCE_THRESHOLD,
      luminanceSmoothing: BLOOM_LUMINANCE_SMOOTHING,
      mipmapBlur: true,
      radius: BLOOM_RADIUS,
      levels: BLOOM_MIP_LEVELS,
    })
    const pass = new EffectPass(camera, effect)
    pass.enabled = false

    return [effect, pass] as const
  }, [camera])

  useEffect(() => () => bloomPass.dispose(), [bloomPass])

  useFrame(() => {
    const intensity = tunnelBloomIntensity(
      journeyProgress.current,
      postEffects.tunnelBloom,
    )
    bloom.intensity = intensity
    // Avoid the luminance and mip-chain draws before the portal opens.
    bloomPass.enabled = intensity > 0.0001
  }, -10)

  return <primitive object={bloomPass} />
}

function JourneyColorOutputPass({
  journeyProgress,
}: JourneyPostProcessingProps) {
  const camera = useThree((state) => state.camera)
  const canvasWidth = useThree((state) => state.size.width)
  // Lock to the initial viewport, matching the tunnel and particle systems.
  const isMobileRef = useRef(canvasWidth <= MOBILE_BREAKPOINT)
  const [aberration, outputPass] = useMemo(() => {
    const toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    })

    if (isMobileRef.current) {
      return [null, new EffectPass(camera, toneMapping)] as const
    }

    const chromaticAberration = new ChromaticAberrationEffect({
      offset: new Vector2(),
      radialModulation: true,
      modulationOffset: ABERRATION_MODULATION_OFFSET,
    })

    // Chromatic aberration and ACES share this single final fullscreen pass.
    return [
      chromaticAberration,
      new EffectPass(camera, chromaticAberration, toneMapping),
    ] as const
  }, [camera])

  useEffect(() => () => outputPass.dispose(), [outputPass])

  useFrame(() => {
    if (!aberration) return

    const effect = postEffects.chromaticAberration
    const magnitude = chromaticAberrationOffset(
      journeyProgress.current,
      effect,
    )
    const direction = chromaticAberrationDirection(
      journeyProgress.current,
      effect,
    )

    aberration.offset.set(
      Math.cos(direction) * magnitude,
      Math.sin(direction) * magnitude,
    )
  }, -10)

  return <primitive object={outputPass} />
}

export function JourneyPostProcessing({
  journeyProgress,
}: JourneyPostProcessingProps) {
  return (
    <EffectComposer
      depthBuffer={false}
      multisampling={0}
      frameBufferType={HalfFloatType}
    >
      <JourneyBloomPass journeyProgress={journeyProgress} />
      <JourneyColorOutputPass journeyProgress={journeyProgress} />
    </EffectComposer>
  )
}

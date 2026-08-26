import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { HalfFloatType } from 'three'
import {
  BlendFunction,
  BloomEffect,
  EffectPass,
  ToneMappingMode,
} from 'postprocessing'
import { postEffects } from '../timeline/experienceTimeline'
import { tunnelBloomIntensity } from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'

const BLOOM_LUMINANCE_THRESHOLD = 1.1
const BLOOM_LUMINANCE_SMOOTHING = 0.08
const BLOOM_RADIUS = 0.72
const BLOOM_MIP_LEVELS = 5

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
      {/* The composer disables renderer tone mapping; restore Canvas ACES last. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

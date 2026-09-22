import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, PlaneGeometry, ShaderMaterial } from 'three'
import {
  alienEyeFragmentShader,
  alienEyeVertexShader,
} from './alienEyeShader'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import type { RenderQualityProfile } from '../renderQuality'

export const EYE_DEPTH = -6.4

interface AlienEyeProps {
  journeyProgress: JourneyProgressRef
  quality: RenderQualityProfile
}

/*
  The eye lives at the end of the tunnel. It is a camera-facing plane drawn
  before the mandala rings (renderOrder -2) that writes depth only inside its
  visible disk, so rings passing in front still layer correctly while rings
  behind it stay hidden.
*/
export function AlienEye({ journeyProgress, quality }: AlienEyeProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  const geometry = useMemo(() => new PlaneGeometry(2, 2), [])

  const uniforms = useMemo(
    () => ({
      uEyeStrength: { value: 0 },
      uPupilStrength: { value: 0 },
      uEyeGlint: { value: 0 },
      uEyeBlink: { value: 0 },
      uDetail: { value: quality.tunnelDetail },
      uReveal: { value: 0 },
    }),
    [quality],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) return

    const journey = journeyProgress.current
    const eye = worldEffects.eyeEmergence
    const geometryHandoff = smootherstep01(
      segmentProgress(journey, worldEffects.sacredGeometry.stages.eyeIntegration),
    )
    const eyeStrength = smootherstep01(
      segmentProgress(journey, eye.stages.iris),
    )
    const visible = eyeStrength > 0.0005 && geometryHandoff < 0.9999
    material.visible = visible
    if (!visible) return

    const u = material.uniforms
    u.uEyeStrength.value = eyeStrength * (1 - geometryHandoff)
    u.uPupilStrength.value = smootherstep01(
      segmentProgress(journey, eye.stages.pupil),
    )
    u.uEyeGlint.value = smootherstep01(
      segmentProgress(journey, eye.stages.glint),
    )
    const blinkClose = smootherstep01(
      segmentProgress(journey, eye.stages.blinkClose),
    )
    const blinkReopen = smootherstep01(
      segmentProgress(journey, eye.stages.blinkReopen),
    )
    u.uEyeBlink.value = blinkClose * (1 - blinkReopen)
    u.uReveal.value = smootherstep01(
      segmentProgress(journey, worldEffects.tunnel),
    )
  })

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, EYE_DEPTH]}
      frustumCulled={false}
      renderOrder={5}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={alienEyeVertexShader}
        fragmentShader={alienEyeFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

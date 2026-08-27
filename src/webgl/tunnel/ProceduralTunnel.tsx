import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  Vector2,
} from 'three'
import {
  tunnelFragmentShader,
  tunnelVertexShader,
} from './tunnelShader'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  clamp01,
  segmentProgress,
  smootherstep01,
  smoothstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'

const RAYMARCH_STEPS_DESKTOP = 64
const RAYMARCH_STEPS_MOBILE = 40
const ORGANIC_IDLE_ANGULAR_SPEED =
  (Math.PI * 2) / worldEffects.organicMetamorphosis.idleCycleSeconds

// Single fullscreen triangle in clip space; covers the viewport without
// depending on the PerspectiveCamera. Created once, never per frame.
const FULLSCREEN_TRIANGLE = new Float32Array([
  -1, -1, 0,
  3, -1, 0,
  -1, 3, 0,
])

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

interface ProceduralTunnelProps {
  journeyProgress: JourneyProgressRef
}

export function ProceduralTunnel({ journeyProgress }: ProceduralTunnelProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  const canvasWidth = useThree((state) => state.size.width)
  const canvasHeight = useThree((state) => state.size.height)
  const dpr = useThree((state) => state.viewport.dpr)
  // Same initial-width convention as ParticleSystem; locked for the session.
  const isMobileRef = useRef(canvasWidth <= 768)

  const resolutionUniform = useMemo(() => ({ value: new Vector2(1, 1) }), [])

  const uniforms = useMemo<Record<string, { value: number | Vector2 }>>(
    () => ({
      uResolution: resolutionUniform,
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uTravel: { value: 0 },
      uSymmetry: { value: worldEffects.tunnel.symmetryFrom },
      uTwist: { value: worldEffects.tunnel.twistFrom },
      uColorPhase: { value: 0 },
      uSpectralProgress: { value: 0 },
      uOrganicStrength: { value: 0 },
      uCellularStrength: { value: 0 },
      uOrganicCore: { value: 0 },
      uOrganicPulse: { value: 1 },
      uEyeStrength: { value: 0 },
      uPupilStrength: { value: 0 },
      uEyeGlint: { value: 0 },
      uEyeBlink: { value: 0 },
      uLifeSeed: { value: 0 },
      uSeedHandoff: { value: 0 },
      uOrganicAsymmetry: {
        value: worldEffects.organicMetamorphosis.maxAsymmetry,
      },
      uStepLimit: {
        value: isMobileRef.current
          ? RAYMARCH_STEPS_MOBILE
          : RAYMARCH_STEPS_DESKTOP,
      },
      uDetail: { value: isMobileRef.current ? 0 : 1 },
    }),
    [resolutionUniform],
  )

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute(
      'position',
      new BufferAttribute(FULLSCREEN_TRIANGLE, 3),
    )
    return geo
  }, [])

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return

    /*
      Uniform identity: R3F applyProps merges the JSX uniforms object into the
      material's own uniform entries, so the memoized object is NOT the mounted
      runtime reference. All animated values must be written through
      material.uniforms below.
    */
    const u = material.uniforms

    const journey = journeyProgress.current
    const effect = worldEffects.tunnel
    const local = segmentProgress(journey, effect)
    const revealRaw = clamp01(local / effect.revealFraction)
    const life = worldEffects.lifeSeed
    const tunnelFade = smootherstep01(
      segmentProgress(journey, life.stages.backgroundFade),
    )

    // Skip the raymarch before the portal and after LIFE owns the frame.
    material.visible =
      revealRaw > 0.0005 && journey < life.stages.backgroundFade.end
    if (!material.visible) return

    const reveal = smootherstep01(revealRaw)

    ;(u.uResolution.value as Vector2).set(canvasWidth * dpr, canvasHeight * dpr)
    u.uTime.value = clock.elapsedTime
    u.uReveal.value = reveal
    u.uOpacity.value = smoothstep01(revealRaw) * (1 - tunnelFade)
    u.uTravel.value = effect.maxTravelDistance * smootherstep01(local)
    u.uSymmetry.value = mix(
      effect.symmetryFrom,
      effect.symmetryTo,
      smoothstep01(local),
    )
    u.uTwist.value = mix(effect.twistFrom, effect.twistTo, local)
    u.uColorPhase.value = local * 0.65
    u.uSpectralProgress.value = smootherstep01(local)

    const organic = worldEffects.organicMetamorphosis
    u.uOrganicStrength.value = smootherstep01(
      segmentProgress(journey, organic),
    )
    u.uCellularStrength.value = smootherstep01(
      segmentProgress(journey, organic.stages.cellular),
    )
    u.uOrganicCore.value = smootherstep01(
      segmentProgress(journey, organic.stages.livingCore),
    )
    const eye = worldEffects.eyeEmergence
    u.uEyeStrength.value = smootherstep01(
      segmentProgress(journey, eye.stages.iris),
    )
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
    u.uLifeSeed.value = smootherstep01(
      segmentProgress(journey, eye.stages.emergence),
    )
    u.uSeedHandoff.value = smootherstep01(
      segmentProgress(journey, life.stages.handoff),
    )
    u.uOrganicPulse.value =
      1 +
      organic.idleAmplitude *
        Math.sin(clock.elapsedTime * ORGANIC_IDLE_ANGULAR_SPEED)
  })

  /*
    Layering: renderOrder -1 draws the tunnel before the additive particles;
    depthTest/depthWrite are off so both systems composite by order alone.
    Before the portal the fragment alpha is zero and material.visible is
    false, so particles are never obscured.
  */
  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={tunnelVertexShader}
        fragmentShader={tunnelFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

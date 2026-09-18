import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
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
import type { RenderQualityProfile } from '../renderQuality'
import { schedulePrewarmTasks } from '../schedulePrewarmTasks'
import {
  beginPreparation,
  completePreparation,
  failPreparation,
  type TunnelPreparationState,
} from '../tunnelPerformance'

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
  quality: RenderQualityProfile
  preparation: TunnelPreparationState
  debugPerf: boolean
}

function setFamilyEvolution(target: Vector2, phase: number): void {
  if (phase < 0.3) {
    target.set(0, 0)
  } else if (phase < 0.4) {
    target.set(0, smoothstep01((phase - 0.3) / 0.1))
  } else if (phase < 0.66) {
    target.set(1, 0)
  } else if (phase < 0.76) {
    target.set(1, smoothstep01((phase - 0.66) / 0.1))
  } else {
    target.set(2, 0)
  }
}

export function ProceduralTunnel({
  journeyProgress,
  quality,
  preparation,
  debugPerf,
}: ProceduralTunnelProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  const resolutionUniform = useMemo(() => ({ value: new Vector2(1, 1) }), [])
  const drawingBufferSize = useMemo(() => new Vector2(), [])

  const uniforms = useMemo<Record<string, { value: number | Vector2 }>>(
    () => ({
      uResolution: resolutionUniform,
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uTravel: { value: 0 },
      uFamilyEvolution: { value: new Vector2() },
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
      uOrganicAsymmetry: {
        value: worldEffects.organicMetamorphosis.maxAsymmetry,
      },
      uStepLimit: { value: quality.tunnelSteps },
      uDetail: { value: quality.tunnelDetail },
    }),
    [quality, resolutionUniform],
  )

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute(
      'position',
      new BufferAttribute(FULLSCREEN_TRIANGLE, 3),
    )
    return geo
  }, [])

  useEffect(() => {
    let active = true
    const scheduled = schedulePrewarmTasks([
      async () => {
        beginPreparation(preparation, 'tunnel', gl, debugPerf)
        const material = materialRef.current
        if (!material) throw new Error('Tunnel material is not mounted')

        // Three's compile() traverses all scene materials, including invisible
        // ones. This also prepares the sacred-geometry shader used at handoff.
        await gl.compileAsync(scene, camera, scene)
        if (!active) return

        const previousRenderTarget = gl.getRenderTarget()
        const warmScene = new Scene()
        const prewarmMesh = new Mesh(geometry, material)
        const warmTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false })
        const previousMaterialVisibility = material.visible
        const resolution = material.uniforms.uResolution.value as Vector2
        const previousResolutionX = resolution.x
        const previousResolutionY = resolution.y
        prewarmMesh.frustumCulled = false
        warmScene.add(prewarmMesh)

        try {
          material.visible = true
          resolution.set(1, 1)
          gl.initRenderTarget(warmTarget)
          gl.setRenderTarget(warmTarget)
          gl.render(warmScene, camera)
        } finally {
          gl.setRenderTarget(previousRenderTarget)
          material.visible = previousMaterialVisibility
          resolution.set(previousResolutionX, previousResolutionY)
          warmScene.remove(prewarmMesh)
          warmTarget.dispose()
        }
      },
    ])
    scheduled.promise
      .then(() => {
        if (active) completePreparation(preparation, 'tunnel', gl, debugPerf)
      })
      .catch((error: unknown) => {
        if (active) failPreparation(preparation, 'tunnel', error, debugPerf)
      })

    return () => {
      active = false
      scheduled.cancel()
    }
  }, [camera, debugPerf, geometry, gl, preparation, scene])

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
    const sacredGeometry = worldEffects.sacredGeometry
    const tunnelFade = smootherstep01(
      segmentProgress(journey, sacredGeometry.stages.eyeIntegration),
    )

    // Skip the raymarch before the portal and after LIFE owns the frame.
    material.visible =
      revealRaw > 0.0005 && journey < sacredGeometry.stages.eyeIntegration.end
    if (!material.visible) return

    const reveal = smootherstep01(revealRaw)

    gl.getDrawingBufferSize(drawingBufferSize)
    ;(u.uResolution.value as Vector2).copy(drawingBufferSize)
    u.uTime.value = clock.elapsedTime
    u.uReveal.value = reveal
    u.uOpacity.value = smoothstep01(revealRaw) * (1 - tunnelFade)
    u.uTravel.value = effect.maxTravelDistance * smootherstep01(local)
    const symmetry = mix(
      effect.symmetryFrom,
      effect.symmetryTo,
      smoothstep01(local),
    )
    setFamilyEvolution(
      u.uFamilyEvolution.value as Vector2,
      clamp01((symmetry - 6) / 6),
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

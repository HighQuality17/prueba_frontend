import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, ShaderMaterial, Vector2 } from 'three'
import {
  tunnelGeometryFragmentShader,
  tunnelGeometryVertexShader,
} from './tunnelGeometryShader'
import { createMandalaRingGeometry } from './mandalaRingGeometry'
import { selectTunnelLayers } from './tunnelLayers'
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

const CELL_LENGTH = 2.2
const MAX_RAY_DISTANCE = 30
const FOG_DENSITY_DESKTOP = 0.1
const FOG_DENSITY_MOBILE = 0.115

const ORGANIC_IDLE_ANGULAR_SPEED =
  (Math.PI * 2) / worldEffects.organicMetamorphosis.idleCycleSeconds

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
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

interface ProceduralTunnelProps {
  journeyProgress: JourneyProgressRef
  quality: RenderQualityProfile
  preparation: TunnelPreparationState
  debugPerf: boolean
}

/*
  Instanced 3D mandala tunnel. A single draw call carries every (layer, cell)
  ribbon; the vertex shader slides each instance along Z and reconstructs the
  curated families. Replaces the fullscreen SDF raymarcher on every device.
*/
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

  const layout = useMemo(
    () =>
      createMandalaRingGeometry({
        angularSegments: quality.tunnelAngularSegments,
        crossSegments: quality.tunnelCrossSegments,
        cells: quality.tunnelCells,
        cellLength: CELL_LENGTH,
        layers: selectTunnelLayers(quality.tunnelLayers),
      }),
    [quality],
  )

  const uniforms = useMemo(
    () => ({
      uTravel: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uTwist: { value: worldEffects.tunnel.twistFrom },
      uColorPhase: { value: 0 },
      uSpectralProgress: { value: 0 },
      uFamilyEvolution: { value: new Vector2() },
      uOrganicStrength: { value: 0 },
      uCellularStrength: { value: 0 },
      uOrganicCore: { value: 0 },
      uOrganicPulse: { value: 1 },
      uOrganicAsymmetry: {
        value: worldEffects.organicMetamorphosis.maxAsymmetry,
      },
      uDetail: { value: quality.tunnelDetail },
      uCellLength: { value: CELL_LENGTH },
      uSpan: { value: layout.span },
      uFogDensity: {
        value: quality.isMobile ? FOG_DENSITY_MOBILE : FOG_DENSITY_DESKTOP,
      },
      uMaxRayDistance: { value: MAX_RAY_DISTANCE },
    }),
    [layout, quality],
  )

  useEffect(() => {
    let active = true
    const scheduled = schedulePrewarmTasks([
      async () => {
        beginPreparation(preparation, 'tunnel', gl, debugPerf)
        // Compiling the scene also prepares the eye and reveal-mask shaders.
        await gl.compileAsync(scene, camera, scene)
        if (!active) return
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
  }, [camera, debugPerf, gl, preparation, scene])

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return

    const u = material.uniforms
    const journey = journeyProgress.current
    const effect = worldEffects.tunnel
    const local = segmentProgress(journey, effect)
    const revealRaw = clamp01(local / effect.revealFraction)
    const sacredGeometry = worldEffects.sacredGeometry
    const tunnelFade = smootherstep01(
      segmentProgress(journey, sacredGeometry.stages.eyeIntegration),
    )

    const shouldRender =
      revealRaw > 0.0005 &&
      journey < sacredGeometry.stages.eyeIntegration.end
    material.visible = shouldRender
    if (!shouldRender) return

    const reveal = smootherstep01(revealRaw)
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
    u.uOrganicPulse.value =
      1 +
      organic.idleAmplitude *
        Math.sin(clock.elapsedTime * ORGANIC_IDLE_ANGULAR_SPEED)
  })

  return (
    <mesh geometry={layout.geometry} frustumCulled={false} renderOrder={-1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={tunnelGeometryVertexShader}
        fragmentShader={tunnelGeometryFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

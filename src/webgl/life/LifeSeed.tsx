import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { IcosahedronGeometry, Mesh, ShaderMaterial } from 'three'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  sineSquaredEnvelope,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import {
  lifeSeedFragmentShader,
  lifeSeedVertexShader,
} from './lifeSeedShader'

const SEED_START_X = 0.02
const SEED_START_Z = -5.65
const SEED_FINAL_Z = SEED_START_Z + worldEffects.lifeSeed.forwardDistance

interface LifeSeedProps {
  journeyProgress: JourneyProgressRef
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

export function LifeSeed({ journeyProgress }: LifeSeedProps) {
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<ShaderMaterial>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const isMobileRef = useRef(canvasWidth <= 768)
  const geometry = useMemo(() => new IcosahedronGeometry(1, 4), [])
  const uniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uDetail: { value: 1 },
      uFormStrength: { value: 0 },
    }),
    [],
  )

  useFrame(() => {
    const mesh = meshRef.current
    const material = materialRef.current
    if (!mesh || !material) return

    const journey = journeyProgress.current
    const effect = worldEffects.lifeSeed
    const handoff = smootherstep01(
      segmentProgress(journey, effect.stages.handoff),
    )
    const detachment = smootherstep01(
      segmentProgress(journey, effect.stages.detachment),
    )
    const pulse = sineSquaredEnvelope(
      segmentProgress(journey, effect.stages.pulse),
    )

    mesh.visible = journey > effect.start && handoff > 0.0001
    if (!mesh.visible) return

    const baseScale = mix(
      effect.initialScale,
      effect.finalScale,
      detachment,
    )
    mesh.position.set(
      SEED_START_X,
      effect.verticalLift * detachment,
      mix(SEED_START_Z, SEED_FINAL_Z, detachment),
    )
    mesh.scale.setScalar(baseScale * (1 + effect.pulseAmplitude * pulse))

    const u = material.uniforms
    u.uOpacity.value = handoff
    u.uPulse.value = pulse
    u.uDetail.value = isMobileRef.current ? 0 : 1
    u.uFormStrength.value = detachment
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[SEED_START_X, 0, SEED_START_Z]}
      frustumCulled={false}
      renderOrder={1}
      visible={false}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={lifeSeedVertexShader}
        fragmentShader={lifeSeedFragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

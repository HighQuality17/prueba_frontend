import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  LineSegments,
  Mesh,
  ShaderMaterial,
} from 'three'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  sineSquaredEnvelope,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import {
  LIFE_SEED_FINAL_POSITION,
  LIFE_SEED_START_POSITION,
} from './lifeLayout'
import {
  germinalCoreFragmentShader,
  germinalCoreVertexShader,
  germinalFilamentFragmentShader,
  germinalFilamentVertexShader,
  lifeSeedFragmentShader,
  lifeSeedVertexShader,
} from './lifeSeedShader'

const FILAMENT_COUNT = 6
const FILAMENT_SEGMENTS = 14

interface LifeSeedProps {
  journeyProgress: JourneyProgressRef
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function filamentPoint(
  filamentIndex: number,
  progress: number,
): readonly [number, number, number] {
  const baseAngle = (filamentIndex / FILAMENT_COUNT) * Math.PI * 2
  const direction = filamentIndex % 2 === 0 ? 1 : -1
  const curve = direction * 0.24 * Math.sin(progress * Math.PI)
  const angle = baseAngle + curve
  const radius = 0.16 + 0.7 * progress

  return [
    Math.cos(angle) * radius * 0.92,
    Math.sin(angle) * radius * 1.08,
    0.12 + 0.28 * Math.sin(progress * Math.PI) + 0.12 * progress,
  ]
}

function createFilamentGeometry(): BufferGeometry {
  const positions: number[] = []
  const growth: number[] = []
  const filamentIds: number[] = []

  for (let filament = 0; filament < FILAMENT_COUNT; filament++) {
    for (let segment = 0; segment < FILAMENT_SEGMENTS; segment++) {
      const from = segment / FILAMENT_SEGMENTS
      const to = (segment + 1) / FILAMENT_SEGMENTS
      positions.push(...filamentPoint(filament, from))
      positions.push(...filamentPoint(filament, to))
      growth.push(from, to)
      filamentIds.push(filament, filament)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setAttribute(
    'aGrowth',
    new BufferAttribute(new Float32Array(growth), 1),
  )
  geometry.setAttribute(
    'aFilamentId',
    new BufferAttribute(new Float32Array(filamentIds), 1),
  )
  return geometry
}

export function LifeSeed({ journeyProgress }: LifeSeedProps) {
  const groupRef = useRef<Group>(null)
  const shellMaterialRef = useRef<ShaderMaterial>(null)
  const coreRef = useRef<Mesh>(null)
  const coreMaterialRef = useRef<ShaderMaterial>(null)
  const filamentRef = useRef<LineSegments>(null)
  const filamentMaterialRef = useRef<ShaderMaterial>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const isMobileRef = useRef(canvasWidth <= 768)
  const shellGeometry = useMemo(() => new IcosahedronGeometry(1, 4), [])
  const coreGeometry = useMemo(() => new IcosahedronGeometry(1, 3), [])
  const filamentGeometry = useMemo(() => createFilamentGeometry(), [])
  const shellUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
      uDetail: { value: 1 },
      uFormStrength: { value: 0 },
      uActivation: { value: 0 },
      uTension: { value: 0 },
      uOpening: { value: 0 },
    }),
    [],
  )
  const coreUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uCoreReveal: { value: 0 },
      uDetail: { value: 1 },
    }),
    [],
  )
  const filamentUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uGrowth: { value: 0 },
      uOpacity: { value: 0 },
      uDetail: { value: 1 },
    }),
    [],
  )

  useFrame(() => {
    const group = groupRef.current
    const shellMaterial = shellMaterialRef.current
    const core = coreRef.current
    const coreMaterial = coreMaterialRef.current
    const filaments = filamentRef.current
    const filamentMaterial = filamentMaterialRef.current
    if (
      !group ||
      !shellMaterial ||
      !core ||
      !coreMaterial ||
      !filaments ||
      !filamentMaterial
    ) return

    const journey = journeyProgress.current
    const effect = worldEffects.lifeSeed
    const germination = worldEffects.seedGermination
    const handoff = smootherstep01(
      segmentProgress(journey, effect.stages.handoff),
    )
    const detachment = smootherstep01(
      segmentProgress(journey, effect.stages.detachment),
    )
    const pulse = sineSquaredEnvelope(
      segmentProgress(journey, effect.stages.pulse),
    )
    const activation = smootherstep01(
      segmentProgress(journey, germination.stages.activation),
    )
    const tension = smootherstep01(
      segmentProgress(journey, germination.stages.tension),
    )
    const opening = smootherstep01(
      segmentProgress(journey, germination.stages.opening),
    )
    const coreReveal = smootherstep01(
      segmentProgress(journey, germination.stages.coreReveal),
    )
    const filamentGrowth = smootherstep01(
      segmentProgress(journey, germination.stages.filaments),
    )

    group.visible = journey > effect.start && handoff > 0.0001
    if (!group.visible) return

    const baseScale = mix(
      effect.initialScale,
      effect.finalScale,
      detachment,
    )
    group.position.set(
      LIFE_SEED_START_POSITION.x,
      mix(
        LIFE_SEED_START_POSITION.y,
        LIFE_SEED_FINAL_POSITION.y,
        detachment,
      ),
      mix(
        LIFE_SEED_START_POSITION.z,
        LIFE_SEED_FINAL_POSITION.z,
        detachment,
      ),
    )
    group.scale.setScalar(baseScale * (1 + effect.pulseAmplitude * pulse))

    const detail = isMobileRef.current ? 0 : 1
    const shell = shellMaterial.uniforms
    shell.uOpacity.value = handoff
    shell.uPulse.value = pulse
    shell.uDetail.value = detail
    shell.uFormStrength.value = detachment
    shell.uActivation.value = activation
    shell.uTension.value = tension
    shell.uOpening.value = opening

    core.visible = coreReveal > 0.0001
    coreMaterial.uniforms.uCoreReveal.value = coreReveal
    coreMaterial.uniforms.uDetail.value = detail

    filaments.visible = filamentGrowth > 0.0001
    filamentMaterial.uniforms.uGrowth.value = filamentGrowth
    filamentMaterial.uniforms.uOpacity.value = filamentGrowth
    filamentMaterial.uniforms.uDetail.value = detail
  })

  return (
    <group
      ref={groupRef}
      position={[
        LIFE_SEED_START_POSITION.x,
        LIFE_SEED_START_POSITION.y,
        LIFE_SEED_START_POSITION.z,
      ]}
      frustumCulled={false}
      visible={false}
    >
      <mesh geometry={shellGeometry} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          ref={shellMaterialRef}
          vertexShader={lifeSeedVertexShader}
          fragmentShader={lifeSeedFragmentShader}
          uniforms={shellUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={coreRef}
        geometry={coreGeometry}
        scale={0.38}
        frustumCulled={false}
        renderOrder={1}
        visible={false}
      >
        <shaderMaterial
          ref={coreMaterialRef}
          vertexShader={germinalCoreVertexShader}
          fragmentShader={germinalCoreFragmentShader}
          uniforms={coreUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        ref={filamentRef}
        geometry={filamentGeometry}
        frustumCulled={false}
        renderOrder={3}
        visible={false}
      >
        <shaderMaterial
          ref={filamentMaterialRef}
          vertexShader={germinalFilamentVertexShader}
          fragmentShader={germinalFilamentFragmentShader}
          uniforms={filamentUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </lineSegments>
    </group>
  )
}

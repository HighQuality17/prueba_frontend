import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  sineSquaredEnvelope,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import {
  alienMedusaBellFragmentShader,
  alienMedusaBellVertexShader,
  alienMedusaOrganFragmentShader,
  alienMedusaOrganVertexShader,
  alienMedusaTentacleFragmentShader,
  alienMedusaTentacleVertexShader,
} from './alienMedusaShader'
import {
  ECOSYSTEM_EXCHANGE_NODE_WORLD_POSITION,
  FIRST_LIFEFORM_NODE_WORLD_POSITION,
} from './lifeNetworkLayout'

type MedusaPoint = readonly [number, number, number]

const TENTACLE_COUNT = 6
const TENTACLE_SEGMENTS = 16
const MEDUSA_INITIAL_SCALE = 0.028
const MEDUSA_FINAL_SCALE = 0.105
const MEDUSA_DETACH_OFFSET = { x: 0.1, y: 0.14, z: 0.36 } as const
const MOBILE_TENTACLES = new Set([0, 2, 4])
const TENTACLE_LENGTHS = [1.42, 1.22, 1.58, 1.34, 1.5, 1.26] as const
const MEDUSA_SWIM_CONTROL_1: MedusaPoint = [-0.02, 0.045, 0.015]
const MEDUSA_SWIM_CONTROL_2: MedusaPoint = [-0.12, 0.09, -0.035]
const MEDUSA_SWIM_END: MedusaPoint = [-0.18, 0.075, -0.095]
const MEDUSA_SWIM_RANGE = {
  start: worldEffects.medusaAwakening.stages.swimmingImpulse.start,
  end: worldEffects.medusaAwakening.stages.drift.end,
} as const

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function cubicBezierCoordinate(
  firstControl: number,
  secondControl: number,
  end: number,
  progress: number,
): number {
  const inverse = 1 - progress
  return (
    3 * inverse * inverse * progress * firstControl
    + 3 * inverse * progress * progress * secondControl
    + progress * progress * progress * end
  )
}

function cubicBezierDerivative(
  firstControl: number,
  secondControl: number,
  end: number,
  progress: number,
): number {
  const inverse = 1 - progress
  return (
    3 * inverse * inverse * firstControl
    + 6 * inverse * progress * (secondControl - firstControl)
    + 3 * progress * progress * (end - secondControl)
  )
}

function tentaclePoint(index: number, progress: number): MedusaPoint {
  const angle = (index / TENTACLE_COUNT) * Math.PI * 2
  const direction = index % 2 === 0 ? 1 : -1
  const bend = direction * 0.15 * Math.sin(progress * Math.PI)
  const secondary = 0.045 * Math.sin(progress * Math.PI * 2 + index * 0.72)
  return [
    Math.cos(angle) * 0.46 + bend + secondary,
    -0.16 - TENTACLE_LENGTHS[index] * progress,
    Math.sin(angle) * 0.2
      + direction * 0.13 * Math.sin(progress * Math.PI),
  ]
}

function addTentacleRibbon(
  points: readonly MedusaPoint[],
  id: number,
  type: number,
  mobileVisible: boolean,
  positions: number[],
  across: number[],
  coordinates: number[],
  ids: number[],
  types: number[],
  mobileVisibility: number[],
): void {
  const segmentCount = points.length - 1
  const baseWidth = type > 0.5 ? 0.026 : 0.036

  for (let segment = 0; segment < segmentCount; segment++) {
    const from = points[segment]
    const to = points[segment + 1]
    const fromProgress = segment / segmentCount
    const toProgress = (segment + 1) / segmentCount
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.max(Math.hypot(dx, dy), 0.0001)
    const normalX = -dy / length
    const normalY = dx / length
    const fromWidth = baseWidth * (1 - 0.76 * fromProgress)
    const toWidth = baseWidth * (1 - 0.76 * toProgress)
    const fromLeft: MedusaPoint = [
      from[0] + normalX * fromWidth,
      from[1] + normalY * fromWidth,
      from[2],
    ]
    const fromRight: MedusaPoint = [
      from[0] - normalX * fromWidth,
      from[1] - normalY * fromWidth,
      from[2],
    ]
    const toLeft: MedusaPoint = [
      to[0] + normalX * toWidth,
      to[1] + normalY * toWidth,
      to[2],
    ]
    const toRight: MedusaPoint = [
      to[0] - normalX * toWidth,
      to[1] - normalY * toWidth,
      to[2],
    ]
    const vertices = [fromLeft, fromRight, toLeft, fromRight, toRight, toLeft]
    const vertexAcross = [1, -1, 1, -1, -1, 1]
    const vertexProgress = [
      fromProgress,
      fromProgress,
      toProgress,
      fromProgress,
      toProgress,
      toProgress,
    ]

    for (let vertex = 0; vertex < 6; vertex++) {
      positions.push(...vertices[vertex])
      across.push(vertexAcross[vertex])
      coordinates.push(vertexProgress[vertex])
      ids.push(id)
      types.push(type)
      mobileVisibility.push(mobileVisible ? 1 : 0)
    }
  }
}

function createTentacleGeometry(): BufferGeometry {
  const positions: number[] = []
  const across: number[] = []
  const coordinates: number[] = []
  const ids: number[] = []
  const types: number[] = []
  const mobileVisibility: number[] = []

  for (let tentacle = 0; tentacle < TENTACLE_COUNT; tentacle++) {
    const points = Array.from(
      { length: TENTACLE_SEGMENTS + 1 },
      (_, index) => tentaclePoint(tentacle, index / TENTACLE_SEGMENTS),
    )
    addTentacleRibbon(
      points,
      tentacle,
      0,
      MOBILE_TENTACLES.has(tentacle),
      positions,
      across,
      coordinates,
      ids,
      types,
      mobileVisibility,
    )
  }

  const tetherPoints = Array.from(
    { length: TENTACLE_SEGMENTS + 1 },
    (_, index): MedusaPoint => [0, -index / TENTACLE_SEGMENTS, 0],
  )
  addTentacleRibbon(
    tetherPoints,
    TENTACLE_COUNT,
    1,
    true,
    positions,
    across,
    coordinates,
    ids,
    types,
    mobileVisibility,
  )

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setAttribute(
    'aAcross',
    new BufferAttribute(new Float32Array(across), 1),
  )
  geometry.setAttribute(
    'aCoordinate',
    new BufferAttribute(new Float32Array(coordinates), 1),
  )
  geometry.setAttribute(
    'aTentacleId',
    new BufferAttribute(new Float32Array(ids), 1),
  )
  geometry.setAttribute(
    'aType',
    new BufferAttribute(new Float32Array(types), 1),
  )
  geometry.setAttribute(
    'aMobileVisible',
    new BufferAttribute(new Float32Array(mobileVisibility), 1),
  )
  return geometry
}

interface AlienMedusaProps {
  journeyProgress: JourneyProgressRef
}

export function AlienMedusa({ journeyProgress }: AlienMedusaProps) {
  const groupRef = useRef<Group>(null)
  const bellMaterialRef = useRef<ShaderMaterial>(null)
  const organRef = useRef<Mesh>(null)
  const organMaterialRef = useRef<ShaderMaterial>(null)
  const tentacleRef = useRef<Mesh>(null)
  const tentacleMaterialRef = useRef<ShaderMaterial>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const isMobileRef = useRef(canvasWidth <= 768)
  const bellGeometry = useMemo(
    () => new SphereGeometry(1, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
    [],
  )
  const organGeometry = useMemo(() => new IcosahedronGeometry(1, 2), [])
  const tentacleGeometry = useMemo(() => createTentacleGeometry(), [])
  const bellUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uFormation: { value: 0 },
      uContraction: { value: 0 },
      uDetail: { value: 1 },
      uIdle: { value: 0 },
      uTime: { value: 0 },
      uNourishment: { value: 0 },
    }),
    [],
  )
  const organUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uFormation: { value: 0 },
      uContraction: { value: 0 },
      uDetail: { value: 1 },
      uIdle: { value: 0 },
      uTime: { value: 0 },
      uNourishment: { value: 0 },
    }),
    [],
  )
  const tentacleUniforms = useMemo<
    Record<string, { value: number | Vector3 }>
  >(
    () => ({
      uGrowth: { value: 0 },
      uContraction: { value: 0 },
      uTetherOpacity: { value: 0 },
      uDetail: { value: 1 },
      uSwimDrag: { value: 0 },
      uIdle: { value: 0 },
      uTime: { value: 0 },
      uExchangeProgress: { value: 0 },
      uExchangeStrength: { value: 0 },
      uTetherTarget: { value: new Vector3() },
      uSwimDirection: { value: new Vector3(-1, 0, 0) },
    }),
    [],
  )

  useFrame((state) => {
    const group = groupRef.current
    const bellMaterial = bellMaterialRef.current
    const organ = organRef.current
    const organMaterial = organMaterialRef.current
    const tentacles = tentacleRef.current
    const tentacleMaterial = tentacleMaterialRef.current
    if (
      !group ||
      !bellMaterial ||
      !organ ||
      !organMaterial ||
      !tentacles ||
      !tentacleMaterial
    ) return

    const journey = journeyProgress.current
    const birthEffect = worldEffects.firstLifeform
    const awakeningEffect = worldEffects.medusaAwakening
    const formation = smootherstep01(
      segmentProgress(journey, birthEffect.stages.bellFormation),
    )
    const tentacleGrowth = smootherstep01(
      segmentProgress(journey, birthEffect.stages.tentacleGrowth),
    )
    const detachment = smootherstep01(
      segmentProgress(journey, birthEffect.stages.detachment),
    )
    const connectionRelease = smootherstep01(
      segmentProgress(journey, birthEffect.stages.connectionRelease),
    )
    const contractionLocal = segmentProgress(
      journey,
      birthEffect.stages.contraction,
    )
    const birthContraction = sineSquaredEnvelope(contractionLocal)
    const secondContraction = 0.5
      * sineSquaredEnvelope(
        segmentProgress(journey, awakeningEffect.stages.secondContraction),
      )
    const contraction = Math.min(1, birthContraction + secondContraction)
    const locomotion = smootherstep01(contractionLocal)
    const awakening = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.awakening),
    )
    const swimmingImpulse = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.swimmingImpulse),
    )
    const drift = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.drift),
    )
    const swimProgress = Math.min(1, swimmingImpulse * 0.72 + drift * 0.28)
    const swimDrag = sineSquaredEnvelope(
      segmentProgress(journey, MEDUSA_SWIM_RANGE),
    )
    const proximity = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.ecosystemProximity),
    )
    const exchangeProgress = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.energyExchange),
    )
    const stableIdle = smootherstep01(
      segmentProgress(journey, awakeningEffect.stages.stableHold),
    )
    const nourishmentArrival = smootherstep01(
      (exchangeProgress - 0.72) / 0.2,
    )
    const nourishment = awakening * 0.08 + nourishmentArrival * 0.92

    group.visible = formation > 0.0001
    if (!group.visible) return

    const scale = mix(MEDUSA_INITIAL_SCALE, MEDUSA_FINAL_SCALE, formation)
    const swimX = cubicBezierCoordinate(
      MEDUSA_SWIM_CONTROL_1[0],
      MEDUSA_SWIM_CONTROL_2[0],
      MEDUSA_SWIM_END[0],
      swimProgress,
    )
    const swimY = cubicBezierCoordinate(
      MEDUSA_SWIM_CONTROL_1[1],
      MEDUSA_SWIM_CONTROL_2[1],
      MEDUSA_SWIM_END[1],
      swimProgress,
    )
    const swimZ = cubicBezierCoordinate(
      MEDUSA_SWIM_CONTROL_1[2],
      MEDUSA_SWIM_CONTROL_2[2],
      MEDUSA_SWIM_END[2],
      swimProgress,
    )
    group.scale.setScalar(scale)
    group.position.set(
      FIRST_LIFEFORM_NODE_WORLD_POSITION.x
        + MEDUSA_DETACH_OFFSET.x * detachment
        + swimX,
      FIRST_LIFEFORM_NODE_WORLD_POSITION.y
        + MEDUSA_DETACH_OFFSET.y * detachment
        + 0.025 * locomotion
        + swimY,
      FIRST_LIFEFORM_NODE_WORLD_POSITION.z
        + MEDUSA_DETACH_OFFSET.z * detachment
        + 0.08 * locomotion
        + swimZ,
    )
    group.rotation.x = 0.035 * swimDrag
    group.rotation.z = -0.065 * swimDrag

    const elapsedTime = state.clock.elapsedTime

    const detail = isMobileRef.current ? 0 : 1
    bellMaterial.uniforms.uFormation.value = formation
    bellMaterial.uniforms.uContraction.value = contraction
    bellMaterial.uniforms.uDetail.value = detail
    bellMaterial.uniforms.uIdle.value = stableIdle
    bellMaterial.uniforms.uTime.value = elapsedTime
    bellMaterial.uniforms.uNourishment.value = nourishment

    organ.visible = formation > 0.08
    organMaterial.uniforms.uFormation.value = formation
    organMaterial.uniforms.uContraction.value = contraction
    organMaterial.uniforms.uDetail.value = detail
    organMaterial.uniforms.uIdle.value = stableIdle
    organMaterial.uniforms.uTime.value = elapsedTime
    organMaterial.uniforms.uNourishment.value = nourishment

    tentacles.visible = tentacleGrowth > 0.0001 || detachment > 0.0001
    const tentacle = tentacleMaterial.uniforms
    const birthTether = detachment * (1 - connectionRelease)
    const exchangeTether = proximity * (1 - stableIdle)
    tentacle.uGrowth.value = tentacleGrowth
    tentacle.uContraction.value = contraction
    tentacle.uTetherOpacity.value = Math.max(birthTether, exchangeTether * 0.72)
    tentacle.uDetail.value = detail
    tentacle.uSwimDrag.value = swimDrag
    tentacle.uIdle.value = stableIdle
    tentacle.uTime.value = elapsedTime
    tentacle.uExchangeProgress.value = exchangeProgress
    tentacle.uExchangeStrength.value = exchangeTether
    const swimDirection = tentacle.uSwimDirection.value as Vector3
    const swimDirectionX = cubicBezierDerivative(
      MEDUSA_SWIM_CONTROL_1[0],
      MEDUSA_SWIM_CONTROL_2[0],
      MEDUSA_SWIM_END[0],
      swimProgress,
    )
    const swimDirectionY = cubicBezierDerivative(
      MEDUSA_SWIM_CONTROL_1[1],
      MEDUSA_SWIM_CONTROL_2[1],
      MEDUSA_SWIM_END[1],
      swimProgress,
    )
    const swimDirectionZ = cubicBezierDerivative(
      MEDUSA_SWIM_CONTROL_1[2],
      MEDUSA_SWIM_CONTROL_2[2],
      MEDUSA_SWIM_END[2],
      swimProgress,
    )
    swimDirection
      .set(swimDirectionX, swimDirectionY, swimDirectionZ)
      .normalize()
    const tetherTargetX = mix(
      FIRST_LIFEFORM_NODE_WORLD_POSITION.x,
      ECOSYSTEM_EXCHANGE_NODE_WORLD_POSITION.x,
      proximity,
    )
    const tetherTargetY = mix(
      FIRST_LIFEFORM_NODE_WORLD_POSITION.y,
      ECOSYSTEM_EXCHANGE_NODE_WORLD_POSITION.y,
      proximity,
    )
    const tetherTargetZ = mix(
      FIRST_LIFEFORM_NODE_WORLD_POSITION.z,
      ECOSYSTEM_EXCHANGE_NODE_WORLD_POSITION.z,
      proximity,
    )
    ;(tentacle.uTetherTarget.value as Vector3).set(
      (tetherTargetX - group.position.x) / scale,
      (tetherTargetY - group.position.y) / scale,
      (tetherTargetZ - group.position.z) / scale,
    )
  })

  return (
    <group
      ref={groupRef}
      position={[
        FIRST_LIFEFORM_NODE_WORLD_POSITION.x,
        FIRST_LIFEFORM_NODE_WORLD_POSITION.y,
        FIRST_LIFEFORM_NODE_WORLD_POSITION.z,
      ]}
      scale={MEDUSA_INITIAL_SCALE}
      frustumCulled={false}
      visible={false}
    >
      <mesh
        ref={tentacleRef}
        geometry={tentacleGeometry}
        frustumCulled={false}
        renderOrder={5}
        visible={false}
      >
        <shaderMaterial
          ref={tentacleMaterialRef}
          vertexShader={alienMedusaTentacleVertexShader}
          fragmentShader={alienMedusaTentacleFragmentShader}
          uniforms={tentacleUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={organRef}
        geometry={organGeometry}
        position={[0, 0.25, 0]}
        scale={0.24}
        frustumCulled={false}
        renderOrder={6}
        visible={false}
      >
        <shaderMaterial
          ref={organMaterialRef}
          vertexShader={alienMedusaOrganVertexShader}
          fragmentShader={alienMedusaOrganFragmentShader}
          uniforms={organUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={bellGeometry} frustumCulled={false} renderOrder={7}>
        <shaderMaterial
          ref={bellMaterialRef}
          vertexShader={alienMedusaBellVertexShader}
          fragmentShader={alienMedusaBellFragmentShader}
          uniforms={bellUniforms}
          side={DoubleSide}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

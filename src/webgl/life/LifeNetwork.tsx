import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  ShaderMaterial,
} from 'three'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import { LIFE_SEED_FINAL_POSITION } from './lifeLayout'
import {
  lifeNetworkFragmentShader,
  lifeNetworkVertexShader,
  lifeNodeFragmentShader,
  lifeNodeVertexShader,
} from './lifeNetworkShader'

type NetworkPoint = readonly [number, number, number]

interface NetworkPath {
  readonly points: readonly NetworkPoint[]
  readonly type: number
  readonly id: number
  readonly mobileVisible: boolean
}

interface NetworkNode {
  readonly position: NetworkPoint
  readonly scale: number
  readonly distance: number
  readonly order: number
  readonly mobileVisible: boolean
}

interface NetworkData {
  readonly branchGeometry: BufferGeometry
  readonly nodeGeometry: IcosahedronGeometry
  readonly nodes: readonly NetworkNode[]
}

const PRIMARY_COUNT = 6
const PRIMARY_SAMPLES = 18
const SECONDARY_SAMPLES = 11
const CONNECTION_SAMPLES = 12
const NETWORK_RADIUS = 2.45
const NETWORK_X_STRETCH = 1.7
const NETWORK_Y_STRETCH = 0.95
const MOBILE_PRIMARY_IDS = new Set([0, 1, 2])
const MOBILE_SECONDARY_IDS = new Set([0, 1, 2])

const PRIMARY_LENGTHS = [2.2, 1.92, 2.36, 2.05, 2.28, 1.88] as const
const PRIMARY_CURVES = [0.18, -0.24, 0.14, -0.19, 0.27, -0.12] as const
const PRIMARY_DEPTHS = [-0.18, 0.14, -0.1, 0.2, -0.16, 0.09] as const

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function networkDistance(point: NetworkPoint): number {
  return clamp01(
    Math.hypot(
      point[0] / NETWORK_X_STRETCH,
      point[1] / NETWORK_Y_STRETCH,
    ) / NETWORK_RADIUS,
  )
}

function primaryPoint(index: number, progress: number): NetworkPoint {
  const baseAngle = (index / PRIMARY_COUNT) * Math.PI * 2
  const radius = 0.86 + (PRIMARY_LENGTHS[index] - 0.86) * progress
  const xStretch = 0.92 + (NETWORK_X_STRETCH - 0.92) * progress
  const yStretch = 1.08 + (NETWORK_Y_STRETCH - 1.08) * progress
  const curve = PRIMARY_CURVES[index] * Math.sin(progress * Math.PI)
  const harmonic = 0.045
    * Math.sin(progress * Math.PI)
    * Math.sin(progress * Math.PI * 2 + index * 0.83)
  const angle = baseAngle + curve + harmonic
  return [
    Math.cos(angle) * radius * xStretch,
    Math.sin(angle) * radius * yStretch,
    0.24 + (PRIMARY_DEPTHS[index] - 0.24) * progress
      + 0.1
        * Math.sin(progress * Math.PI)
        * Math.sin(index * 0.7 + progress * Math.PI),
  ]
}

function samplePath(
  samples: number,
  pointAt: (progress: number) => NetworkPoint,
): readonly NetworkPoint[] {
  return Array.from({ length: samples + 1 }, (_, index) =>
    pointAt(index / samples),
  )
}

function secondaryPath(index: number): readonly NetworkPoint[] {
  const startProgress = 0.58 + (index % 2) * 0.07
  const start = primaryPoint(index, startProgress)
  const baseAngle = (index / PRIMARY_COUNT) * Math.PI * 2
  const direction = index % 2 === 0 ? 1 : -1
  const branchAngle = baseAngle + direction * (0.46 + 0.025 * index)
  const branchLength = 0.7 + (index % 3) * 0.12

  return samplePath(SECONDARY_SAMPLES, (progress) => {
    const curve = direction * 0.13 * Math.sin(progress * Math.PI)
    const angle = branchAngle + curve
    return [
      start[0]
        + Math.cos(angle) * branchLength * progress * NETWORK_X_STRETCH,
      start[1]
        + Math.sin(angle) * branchLength * progress * NETWORK_Y_STRETCH,
      start[2]
        + direction * 0.12 * progress
        + 0.08 * Math.sin(progress * Math.PI),
    ]
  })
}

function connectionPath(
  from: NetworkPoint,
  to: NetworkPoint,
  direction: number,
): readonly NetworkPoint[] {
  const midpoint: NetworkPoint = [
    (from[0] + to[0]) * 0.5,
    (from[1] + to[1]) * 0.5,
    (from[2] + to[2]) * 0.5,
  ]
  const midpointLength = Math.max(Math.hypot(midpoint[0], midpoint[1]), 0.001)
  const outwardX = midpoint[0] / midpointLength
  const outwardY = midpoint[1] / midpointLength

  return samplePath(CONNECTION_SAMPLES, (progress) => {
    const arc = Math.sin(progress * Math.PI)
    return [
      from[0] + (to[0] - from[0]) * progress + outwardX * arc * 0.24,
      from[1] + (to[1] - from[1]) * progress + outwardY * arc * 0.18,
      from[2]
        + (to[2] - from[2]) * progress
        + direction * arc * 0.12,
    ]
  })
}

function addRibbonPath(
  path: NetworkPath,
  positions: number[],
  across: number[],
  coordinates: number[],
  distances: number[],
  pathTypes: number[],
  mobileVisibility: number[],
  pathHues: number[],
): void {
  const segmentCount = path.points.length - 1
  const baseWidth = path.type < 0.5 ? 0.042 : path.type < 1.5 ? 0.029 : 0.021

  for (let segment = 0; segment < segmentCount; segment++) {
    const from = path.points[segment]
    const to = path.points[segment + 1]
    const fromProgress = segment / segmentCount
    const toProgress = (segment + 1) / segmentCount
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.max(Math.hypot(dx, dy), 0.0001)
    const normalX = -dy / length
    const normalY = dx / length
    const fromWidth = baseWidth * (1 - 0.68 * fromProgress)
    const toWidth = baseWidth * (1 - 0.68 * toProgress)
    const fromLeft: NetworkPoint = [
      from[0] + normalX * fromWidth,
      from[1] + normalY * fromWidth,
      from[2],
    ]
    const fromRight: NetworkPoint = [
      from[0] - normalX * fromWidth,
      from[1] - normalY * fromWidth,
      from[2],
    ]
    const toLeft: NetworkPoint = [
      to[0] + normalX * toWidth,
      to[1] + normalY * toWidth,
      to[2],
    ]
    const toRight: NetworkPoint = [
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
      const point = vertices[vertex]
      positions.push(...point)
      across.push(vertexAcross[vertex])
      coordinates.push(vertexProgress[vertex])
      distances.push(networkDistance(point))
      pathTypes.push(path.type)
      mobileVisibility.push(path.mobileVisible ? 1 : 0)
      pathHues.push((path.id % 7) / 6)
    }
  }
}

function createNetworkData(): NetworkData {
  const primaryPaths = Array.from({ length: PRIMARY_COUNT }, (_, index) =>
    samplePath(PRIMARY_SAMPLES, (progress) => primaryPoint(index, progress)),
  )
  const secondaryPaths = Array.from(
    { length: PRIMARY_COUNT },
    (_, index) => secondaryPath(index),
  )
  const connectionPairs = [[0, 1], [2, 3], [4, 5]] as const
  const connectionPaths = connectionPairs.map(([fromIndex, toIndex], index) =>
    connectionPath(
      secondaryPaths[fromIndex][SECONDARY_SAMPLES],
      secondaryPaths[toIndex][SECONDARY_SAMPLES],
      index % 2 === 0 ? 1 : -1,
    ),
  )

  const paths: NetworkPath[] = [
    ...primaryPaths.map((points, index) => ({
      points,
      type: 0,
      id: index,
      mobileVisible: MOBILE_PRIMARY_IDS.has(index),
    })),
    ...secondaryPaths.map((points, index) => ({
      points,
      type: 1,
      id: PRIMARY_COUNT + index,
      mobileVisible: MOBILE_SECONDARY_IDS.has(index),
    })),
    ...connectionPaths.map((points, index) => ({
      points,
      type: 2,
      id: PRIMARY_COUNT * 2 + index,
      mobileVisible: false,
    })),
  ]

  const positions: number[] = []
  const across: number[] = []
  const coordinates: number[] = []
  const distances: number[] = []
  const pathTypes: number[] = []
  const mobileVisibility: number[] = []
  const pathHues: number[] = []
  for (const path of paths) {
    addRibbonPath(
      path,
      positions,
      across,
      coordinates,
      distances,
      pathTypes,
      mobileVisibility,
      pathHues,
    )
  }

  const branchGeometry = new BufferGeometry()
  branchGeometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  branchGeometry.setAttribute(
    'aAcross',
    new BufferAttribute(new Float32Array(across), 1),
  )
  branchGeometry.setAttribute(
    'aPathCoordinate',
    new BufferAttribute(new Float32Array(coordinates), 1),
  )
  branchGeometry.setAttribute(
    'aNetworkDistance',
    new BufferAttribute(new Float32Array(distances), 1),
  )
  branchGeometry.setAttribute(
    'aPathType',
    new BufferAttribute(new Float32Array(pathTypes), 1),
  )
  branchGeometry.setAttribute(
    'aMobileVisible',
    new BufferAttribute(new Float32Array(mobileVisibility), 1),
  )
  branchGeometry.setAttribute(
    'aPathHue',
    new BufferAttribute(new Float32Array(pathHues), 1),
  )

  const nodes: NetworkNode[] = [
    ...primaryPaths.map((points, index) => {
      const position = points[PRIMARY_SAMPLES]
      return {
        position,
        scale: index === 0 || index === 4 ? 0.135 : 0.105,
        distance: networkDistance(position),
        order: 0.12 + index * 0.055,
        mobileVisible: MOBILE_PRIMARY_IDS.has(index),
      }
    }),
    ...secondaryPaths.map((points, index) => {
      const position = points[SECONDARY_SAMPLES]
      return {
        position,
        scale: 0.078 + (index % 2) * 0.012,
        distance: networkDistance(position),
        order: 0.5 + index * 0.055,
        mobileVisible: MOBILE_SECONDARY_IDS.has(index),
      }
    }),
    ...connectionPaths.map((points, index) => {
      const position = points[Math.floor(CONNECTION_SAMPLES * 0.5)]
      return {
        position,
        scale: 0.068 + index * 0.006,
        distance: networkDistance(position),
        order: 0.82 + index * 0.06,
        mobileVisible: false,
      }
    }),
  ]

  const nodeGeometry = new IcosahedronGeometry(1, 2)
  nodeGeometry.setAttribute(
    'aNodeDistance',
    new InstancedBufferAttribute(
      new Float32Array(nodes.map((node) => node.distance)),
      1,
    ),
  )
  nodeGeometry.setAttribute(
    'aNodeOrder',
    new InstancedBufferAttribute(
      new Float32Array(nodes.map((node) => node.order)),
      1,
    ),
  )
  nodeGeometry.setAttribute(
    'aMobileVisible',
    new InstancedBufferAttribute(
      new Float32Array(nodes.map((node) => (node.mobileVisible ? 1 : 0))),
      1,
    ),
  )

  return { branchGeometry, nodeGeometry, nodes }
}

interface LifeNetworkProps {
  journeyProgress: JourneyProgressRef
}

export function LifeNetwork({ journeyProgress }: LifeNetworkProps) {
  const branchRef = useRef<Mesh>(null)
  const branchMaterialRef = useRef<ShaderMaterial>(null)
  const nodeRef = useRef<InstancedMesh>(null)
  const nodeMaterialRef = useRef<ShaderMaterial>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const isMobileRef = useRef(canvasWidth <= 768)
  const network = useMemo(() => createNetworkData(), [])
  const branchUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uPrimaryGrowth: { value: 0 },
      uSecondaryGrowth: { value: 0 },
      uConnectionGrowth: { value: 0 },
      uPulseProgress: { value: 0 },
      uOpacity: { value: 1 },
      uDetail: { value: 1 },
    }),
    [],
  )
  const nodeUniforms = useMemo<Record<string, { value: number }>>(
    () => ({
      uNodeGrowth: { value: 0 },
      uPulseProgress: { value: 0 },
      uOpacity: { value: 1 },
      uDetail: { value: 1 },
    }),
    [],
  )

  useEffect(() => {
    const nodes = nodeRef.current
    if (!nodes) return

    const transform = new Object3D()
    network.nodes.forEach((node, index) => {
      transform.position.set(...node.position)
      transform.scale.setScalar(node.scale)
      transform.updateMatrix()
      nodes.setMatrixAt(index, transform.matrix)
    })
    nodes.instanceMatrix.needsUpdate = true
  }, [network])

  useFrame(() => {
    const branches = branchRef.current
    const branchMaterial = branchMaterialRef.current
    const nodes = nodeRef.current
    const nodeMaterial = nodeMaterialRef.current
    if (!branches || !branchMaterial || !nodes || !nodeMaterial) return

    const journey = journeyProgress.current
    const effect = worldEffects.lifeNetwork
    const primaryGrowth = smootherstep01(
      segmentProgress(journey, effect.stages.primaryBranches),
    )
    const secondaryGrowth = smootherstep01(
      segmentProgress(journey, effect.stages.bifurcations),
    )
    const nodeGrowth = smootherstep01(
      segmentProgress(journey, effect.stages.nodes),
    )
    const connectionGrowth = smootherstep01(
      segmentProgress(journey, effect.stages.connections),
    )
    const pulseProgress = smootherstep01(
      segmentProgress(journey, effect.stages.energyPulse),
    )
    const detail = isMobileRef.current ? 0 : 1

    branches.visible = primaryGrowth > 0.0001
    nodes.visible = nodeGrowth > 0.0001

    const branch = branchMaterial.uniforms
    branch.uPrimaryGrowth.value = primaryGrowth
    branch.uSecondaryGrowth.value = secondaryGrowth
    branch.uConnectionGrowth.value = connectionGrowth
    branch.uPulseProgress.value = pulseProgress
    branch.uDetail.value = detail

    const node = nodeMaterial.uniforms
    node.uNodeGrowth.value = nodeGrowth
    node.uPulseProgress.value = pulseProgress
    node.uDetail.value = detail
  })

  return (
    <group
      position={[
        LIFE_SEED_FINAL_POSITION.x,
        LIFE_SEED_FINAL_POSITION.y,
        LIFE_SEED_FINAL_POSITION.z,
      ]}
      scale={worldEffects.lifeSeed.finalScale}
      frustumCulled={false}
    >
      <mesh
        ref={branchRef}
        geometry={network.branchGeometry}
        frustumCulled={false}
        renderOrder={0}
        visible={false}
      >
        <shaderMaterial
          ref={branchMaterialRef}
          vertexShader={lifeNetworkVertexShader}
          fragmentShader={lifeNetworkFragmentShader}
          uniforms={branchUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={nodeRef}
        args={[undefined, undefined, network.nodes.length]}
        geometry={network.nodeGeometry}
        frustumCulled={false}
        renderOrder={4}
        visible={false}
      >
        <shaderMaterial
          ref={nodeMaterialRef}
          vertexShader={lifeNodeVertexShader}
          fragmentShader={lifeNodeFragmentShader}
          uniforms={nodeUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  )
}

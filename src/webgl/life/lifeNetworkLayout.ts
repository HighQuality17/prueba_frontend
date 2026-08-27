import { worldEffects } from '../timeline/experienceTimeline'
import { LIFE_SEED_FINAL_POSITION } from './lifeLayout'

export type NetworkPoint = readonly [number, number, number]

export const PRIMARY_NETWORK_COUNT = 6
export const NETWORK_X_STRETCH = 1.7
export const NETWORK_Y_STRETCH = 0.95
export const FIRST_LIFEFORM_NODE_INDEX = 0
export const ECOSYSTEM_EXCHANGE_NODE_INDEX = PRIMARY_NETWORK_COUNT

const NETWORK_RADIUS = 2.45
const PRIMARY_LENGTHS = [2.2, 1.92, 2.36, 2.05, 2.28, 1.88] as const
const PRIMARY_CURVES = [0.18, -0.24, 0.14, -0.19, 0.27, -0.12] as const
const PRIMARY_DEPTHS = [-0.18, 0.14, -0.1, 0.2, -0.16, 0.09] as const

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function networkDistance(point: NetworkPoint): number {
  return clamp01(
    Math.hypot(
      point[0] / NETWORK_X_STRETCH,
      point[1] / NETWORK_Y_STRETCH,
    ) / NETWORK_RADIUS,
  )
}

export function primaryNetworkPoint(
  index: number,
  progress: number,
): NetworkPoint {
  const baseAngle = (index / PRIMARY_NETWORK_COUNT) * Math.PI * 2
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

export function secondaryNetworkPoint(
  index: number,
  progress: number,
): NetworkPoint {
  const startProgress = 0.58 + (index % 2) * 0.07
  const start = primaryNetworkPoint(index, startProgress)
  const baseAngle = (index / PRIMARY_NETWORK_COUNT) * Math.PI * 2
  const direction = index % 2 === 0 ? 1 : -1
  const branchAngle = baseAngle + direction * (0.46 + 0.025 * index)
  const branchLength = 0.7 + (index % 3) * 0.12
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
}

export const FIRST_LIFEFORM_NODE_LOCAL_POSITION = primaryNetworkPoint(
  FIRST_LIFEFORM_NODE_INDEX,
  1,
)
export const ECOSYSTEM_EXCHANGE_NODE_LOCAL_POSITION = secondaryNetworkPoint(0, 1)

export const FIRST_LIFEFORM_NODE_WORLD_POSITION = {
  x: LIFE_SEED_FINAL_POSITION.x
    + FIRST_LIFEFORM_NODE_LOCAL_POSITION[0] * worldEffects.lifeSeed.finalScale,
  y: LIFE_SEED_FINAL_POSITION.y
    + FIRST_LIFEFORM_NODE_LOCAL_POSITION[1] * worldEffects.lifeSeed.finalScale,
  z: LIFE_SEED_FINAL_POSITION.z
    + FIRST_LIFEFORM_NODE_LOCAL_POSITION[2] * worldEffects.lifeSeed.finalScale,
} as const

export const ECOSYSTEM_EXCHANGE_NODE_WORLD_POSITION = {
  x: LIFE_SEED_FINAL_POSITION.x
    + ECOSYSTEM_EXCHANGE_NODE_LOCAL_POSITION[0]
      * worldEffects.lifeSeed.finalScale,
  y: LIFE_SEED_FINAL_POSITION.y
    + ECOSYSTEM_EXCHANGE_NODE_LOCAL_POSITION[1]
      * worldEffects.lifeSeed.finalScale,
  z: LIFE_SEED_FINAL_POSITION.z
    + ECOSYSTEM_EXCHANGE_NODE_LOCAL_POSITION[2]
      * worldEffects.lifeSeed.finalScale,
} as const

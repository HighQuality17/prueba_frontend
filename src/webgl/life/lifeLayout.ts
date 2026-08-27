import { worldEffects } from '../timeline/experienceTimeline'

export const LIFE_SEED_START_POSITION = {
  x: 0.02,
  y: 0,
  z: -5.65,
} as const

export const LIFE_SEED_FINAL_POSITION = {
  x: LIFE_SEED_START_POSITION.x,
  y: worldEffects.lifeSeed.verticalLift,
  z: LIFE_SEED_START_POSITION.z + worldEffects.lifeSeed.forwardDistance,
} as const

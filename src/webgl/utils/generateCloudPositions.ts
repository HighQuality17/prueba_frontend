import { createSeededRandom, gaussianFrom } from './random'

/*
  Organic volumetric distribution: a weighted mixture of anisotropic
  Gaussian lobes ("clusters") plus one sparse ambient halo. Different
  weights and radii create areas of higher and lower density instead of
  uniform noise.
*/
interface Lobe {
  center: [number, number, number]
  spread: [number, number, number]
  weight: number
}

const LOBES: Lobe[] = [
  { center: [0.0, 0.15, 0.0], spread: [0.55, 0.55, 0.55], weight: 0.3 },
  { center: [0.7, 0.7, -0.3], spread: [0.45, 0.4, 0.45], weight: 0.18 },
  { center: [-0.6, -0.5, 0.2], spread: [0.4, 0.35, 0.4], weight: 0.14 },
  { center: [0.9, -0.6, -0.5], spread: [0.35, 0.3, 0.35], weight: 0.12 },
  { center: [-0.9, 0.7, -0.4], spread: [0.3, 0.35, 0.3], weight: 0.1 },
  { center: [0.1, 1.0, 0.4], spread: [0.25, 0.3, 0.25], weight: 0.08 },
  { center: [-0.2, -1.0, -0.2], spread: [0.25, 0.25, 0.25], weight: 0.08 },
]

const LOBE_WEIGHT_SUM = LOBES.reduce((sum, lobe) => sum + lobe.weight, 0)

/**
 * Fills `target` (length count * 3) with organic cloud positions.
 * Pure function of (count, seed): deterministic and debuggable.
 */
export function generateCloudPositions(
  count: number,
  seed: number,
): Float32Array {
  const random = createSeededRandom(seed)
  const gaussian = () => gaussianFrom(random)
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    if (random() < LOBE_WEIGHT_SUM) {
      // Weighted lobe pick + anisotropic Gaussian sample.
      let target = random() * LOBE_WEIGHT_SUM
      let lobe = LOBES[0]
      for (const candidate of LOBES) {
        target -= candidate.weight
        if (target <= 0) {
          lobe = candidate
          break
        }
      }
      positions[i3] = lobe.center[0] + gaussian() * lobe.spread[0]
      positions[i3 + 1] = lobe.center[1] + gaussian() * lobe.spread[1]
      positions[i3 + 2] = lobe.center[2] + gaussian() * lobe.spread[2]
    } else {
      // Sparse dim ambient halo scattered through the surrounding void.
      positions[i3] = (random() * 2 - 1) * 3.4
      positions[i3 + 1] = (random() * 2 - 1) * 2.4
      positions[i3 + 2] = (random() * 2 - 1) * 1.8
    }
  }

  return positions
}

import { createSeededRandom, gaussianFrom } from './random'

const HELIX_RADIUS = 0.85
const HELIX_HEIGHT = 3.6
const TURNS = 2.25
// Strand thickness: keeps strands ribbon-like instead of a solid tube.
const STRAND_THICKNESS = 0.12

/**
 * Double helix: two intertwined strands offset by PI, sweeping TURNS
 * revolutions along the y axis. Radius gently tapers toward the ends
 * (vortex silhouette). Index i maps 1:1 to cloud/sphere arrays.
 */
export function generateHelixPositions(
  count: number,
  seed: number,
): Float32Array {
  const random = createSeededRandom(seed)
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // Even parameterization along the helix axis; alternate strands.
    const t = i / (count - 1)
    const strand = i % 2
    const angle =
      t * TURNS * Math.PI * 2 + strand * Math.PI

    // Vortex-like taper: fuller in the middle, narrower at the tips.
    const radius = HELIX_RADIUS * (0.72 + 0.28 * Math.sin(t * Math.PI))
    const thickness = gaussianFrom(random) * STRAND_THICKNESS

    positions[i3] = Math.cos(angle) * radius + Math.cos(angle) * thickness
    positions[i3 + 1] = (t - 0.5) * HELIX_HEIGHT + gaussianFrom(random) * 0.05
    positions[i3 + 2] = Math.sin(angle) * radius + Math.sin(angle) * thickness
  }

  return positions
}

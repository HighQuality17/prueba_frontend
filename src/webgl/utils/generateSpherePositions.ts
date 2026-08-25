import { createSeededRandom } from './random'

const SPHERE_RADIUS = 1.7
// Subtle shell thickness: keeps the silhouette crisp while adding depth.
const RADIAL_JITTER = 0.08

/**
 * Even distribution across the sphere SURFACE using the Fibonacci sphere
 * (golden-angle spiral). No latitude/longitude banding, no interior noise.
 *
 * Index i maps 1:1 to the cloud positions array; same particle count.
 */
export function generateSpherePositions(
  count: number,
  seed: number,
): Float32Array {
  const random = createSeededRandom(seed)
  const positions = new Float32Array(count * 3)

  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // y in (-1, 1) evenly spaced; golden angle around the axis.
    const y = 1 - (i / (count - 1)) * 2
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = goldenAngle * i

    const x = Math.cos(theta) * radiusAtY
    const z = Math.sin(theta) * radiusAtY

    // Controlled radial variation for depth without breaking the outline.
    const r = SPHERE_RADIUS * (1 + (random() * 2 - 1) * RADIAL_JITTER)

    positions[i3] = x * r
    positions[i3 + 1] = y * r
    positions[i3 + 2] = z * r
  }

  return positions
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MAX_RADIUS = 1.65
const BOWL_DEPTH = 0.8

/**
 * Deterministic golden-angle phyllotaxis on a shallow paraboloid.
 * The X/Y projection preserves the characteristic sunflower pattern while
 * Z moves from a forward center to a gently receding outer rim.
 */
export function generateFibonacciPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const angle = i * GOLDEN_ANGLE
    const radius = MAX_RADIUS * Math.sqrt(t)
    const i3 = i * 3

    positions[i3] = Math.cos(angle) * radius
    positions[i3 + 1] = Math.sin(angle) * radius
    positions[i3 + 2] = BOWL_DEPTH * (0.5 - t)
  }

  return positions
}

/*
  Curated mandala contour layers for the geometry tunnel.

  Each layer is a closed ribbon (tube) whose radial distance is displaced by
  the curated family formulas in the vertex shader. Radii, thickness and twist
  mirror the constants of the legacy raymarched tunnel so the visual hierarchy
  (macro / mid / inner / fine) is preserved without per-pixel ray marching.
*/
export interface TunnelLayerDefinition {
  readonly radius: number
  readonly thickness: number
  readonly twist: number
  readonly zCoef: number
  readonly organicAmplitude: number
}

export const TUNNEL_LAYERS: readonly TunnelLayerDefinition[] = [
  {
    radius: 1.76,
    thickness: 0.062,
    twist: 1,
    zCoef: 0.42,
    organicAmplitude: 0.04,
  },
  {
    radius: 1.14,
    thickness: 0.048,
    twist: -0.8,
    zCoef: 0,
    organicAmplitude: 0.07,
  },
  {
    radius: 0.62,
    thickness: 0.04,
    twist: 1.4,
    zCoef: -0.36,
    organicAmplitude: 0.11,
  },
  {
    radius: 0.31,
    thickness: 0.032,
    twist: -1.75,
    zCoef: 0.18,
    organicAmplitude: 0.14,
  },
] as const

export function selectTunnelLayers(
  layerCount: number,
): readonly TunnelLayerDefinition[] {
  return TUNNEL_LAYERS.slice(0, Math.min(layerCount, TUNNEL_LAYERS.length))
}

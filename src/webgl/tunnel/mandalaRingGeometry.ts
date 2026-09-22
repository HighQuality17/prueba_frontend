import {
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Uint32BufferAttribute,
} from 'three'
import type { TunnelLayerDefinition } from './tunnelLayers'

const TWO_PI = Math.PI * 2

export interface MandalaRingGeometryOptions {
  readonly angularSegments: number
  readonly crossSegments: number
  readonly cells: number
  readonly cellLength: number
  readonly layers: readonly TunnelLayerDefinition[]
}

export interface MandalaRingLayout {
  readonly geometry: InstancedBufferGeometry
  readonly instanceCount: number
  readonly cellLength: number
  readonly span: number
}

/*
  Builds one unit ribbon grid shared by every instanced mandala ring. The vertex
  shader receives the ring angle, the tube cross-section direction and a small
  set of per-instance descriptors, then derives the final radius from the
  curated family math. Instance data is static, so scrolling never touches the
  CPU buffers.
*/
export function createMandalaRingGeometry({
  angularSegments,
  crossSegments,
  cells,
  cellLength,
  layers,
}: MandalaRingGeometryOptions): MandalaRingLayout {
  const columns = angularSegments + 1
  const vertexCount = columns * crossSegments

  const positions = new Float32Array(vertexCount * 3)
  const angles = new Float32Array(vertexCount)
  const cross = new Float32Array(vertexCount * 2)

  let vertex = 0
  for (let column = 0; column <= angularSegments; column++) {
    const theta = (column / angularSegments) * TWO_PI
    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)
    for (let slice = 0; slice < crossSegments; slice++) {
      const phi = (slice / crossSegments) * TWO_PI
      const base = vertex * 3
      positions[base] = cosTheta
      positions[base + 1] = sinTheta
      positions[base + 2] = 0
      angles[vertex] = theta
      cross[vertex * 2] = Math.cos(phi)
      cross[vertex * 2 + 1] = Math.sin(phi)
      vertex += 1
    }
  }

  const indices: number[] = []
  for (let column = 0; column < angularSegments; column++) {
    for (let slice = 0; slice < crossSegments; slice++) {
      const nextSlice = (slice + 1) % crossSegments
      const lower = column * crossSegments + slice
      const lowerNext = (column + 1) * crossSegments + slice
      const upper = column * crossSegments + nextSlice
      const upperNext = (column + 1) * crossSegments + nextSlice
      // Double-sided ribbons: winding is irrelevant, both faces are drawn.
      indices.push(lower, lowerNext, upper, lowerNext, upperNext, upper)
    }
  }

  const layerCount = layers.length
  const instanceCount = Math.max(layerCount * cells, 1)
  const cellAttr = new Float32Array(instanceCount)
  const layerIdAttr = new Float32Array(instanceCount)
  const radiusAttr = new Float32Array(instanceCount)
  const thicknessAttr = new Float32Array(instanceCount)
  const twistAttr = new Float32Array(instanceCount)
  const zCoefAttr = new Float32Array(instanceCount)
  const organicAttr = new Float32Array(instanceCount)

  let instance = 0
  for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
    const layer = layers[layerIndex]
    for (let cell = 0; cell < cells; cell++) {
      cellAttr[instance] = cell
      layerIdAttr[instance] = layerIndex
      radiusAttr[instance] = layer.radius
      thicknessAttr[instance] = layer.thickness
      twistAttr[instance] = layer.twist
      zCoefAttr[instance] = layer.zCoef
      organicAttr[instance] = layer.organicAmplitude
      instance += 1
    }
  }

  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aAngle', new Float32BufferAttribute(angles, 1))
  geometry.setAttribute('aCross', new Float32BufferAttribute(cross, 2))
  geometry.setIndex(new Uint32BufferAttribute(indices, 1))
  geometry.setAttribute('aCell', new InstancedBufferAttribute(cellAttr, 1))
  geometry.setAttribute(
    'aLayerId',
    new InstancedBufferAttribute(layerIdAttr, 1),
  )
  geometry.setAttribute(
    'aRadius',
    new InstancedBufferAttribute(radiusAttr, 1),
  )
  geometry.setAttribute(
    'aThickness',
    new InstancedBufferAttribute(thicknessAttr, 1),
  )
  geometry.setAttribute('aTwist', new InstancedBufferAttribute(twistAttr, 1))
  geometry.setAttribute('aZCoef', new InstancedBufferAttribute(zCoefAttr, 1))
  geometry.setAttribute(
    'aOrganic',
    new InstancedBufferAttribute(organicAttr, 1),
  )
  geometry.instanceCount = instanceCount

  return {
    geometry,
    instanceCount,
    cellLength,
    span: cells * cellLength,
  }
}

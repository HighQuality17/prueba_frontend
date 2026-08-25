import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from 'three'
import {
  particlesVertexShader,
  particlesFragmentShader,
} from './shaders/particles'

/*
  Colors come strictly from the design token palette
  (design/design-tokens.json -> color).
*/
const TOKEN = {
  boneWhite: '#ffffff',
  silverMist: '#bdbdbd',
  ashGray: '#9a9a9a',
  electricIris: '#8052ff',
  saffronSpark: '#ffb829',
  deepVerdant: '#15846e',
} as const

const PARTICLE_COUNT_DESKTOP = 12000
const PARTICLE_COUNT_MOBILE = 7000

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

// Sample a standard normal per axis via Box-Muller (one-time CPU cost).
function gaussian(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type ColorRole = 'neutral' | 'iris' | 'saffron' | 'verdant'

function pickRole(): ColorRole {
  const r = Math.random()
  if (r < 0.72) return 'neutral'
  if (r < 0.9) return 'iris'
  if (r < 0.96) return 'saffron'
  return 'verdant'
}

function roleColor(role: ColorRole): [number, number, number] {
  switch (role) {
    case 'neutral': {
      // Neutral particles mix the three token grays/whites.
      const n = Math.random()
      const hex =
        n < 0.4 ? TOKEN.boneWhite : n < 0.72 ? TOKEN.silverMist : TOKEN.ashGray
      const int = parseInt(hex.slice(1), 16)
      return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
      ]
    }
    case 'iris': {
      const int = parseInt(TOKEN.electricIris.slice(1), 16)
      return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
      ]
    }
    case 'saffron': {
      const int = parseInt(TOKEN.saffronSpark.slice(1), 16)
      return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
      ]
    }
    case 'verdant': {
      const int = parseInt(TOKEN.deepVerdant.slice(1), 16)
      return [
        ((int >> 16) & 255) / 255,
        ((int >> 8) & 255) / 255,
        (int & 255) / 255,
      ]
    }
  }
}

export function ParticleSystem() {
  const materialRef = useRef<ShaderMaterial>(null)

  const dpr = useThree((state) => state.viewport.dpr)

  /*
    All buffers are generated once and reused for the lifetime of the
    component; nothing is rebuilt or reallocated per frame.
  */
  const geometry = useMemo(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const seeds = new Float32Array(count)

    // Total lobe weight defines how many particles live in clusters vs halo.
    const lobeWeightSum = LOBES.reduce((sum, lobe) => sum + lobe.weight, 0)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      if (Math.random() < lobeWeightSum) {
        // Weighted lobe pick + anisotropic Gaussian sample.
        let target = Math.random() * lobeWeightSum
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

        sizes[i] = 0.7 + Math.random() * 0.9
      } else {
        // Sparse dim ambient halo scattered through the surrounding void.
        positions[i3] = (Math.random() * 2 - 1) * 3.4
        positions[i3 + 1] = (Math.random() * 2 - 1) * 2.4
        positions[i3 + 2] = (Math.random() * 2 - 1) * 1.8

        sizes[i] = 0.45 + Math.random() * 0.5
      }

      const rgb = roleColor(pickRole())
      const isHalo = sizes[i] < 0.6
      const dimmer = isHalo ? 0.55 : 1
      colors[i3] = rgb[0] * dimmer
      colors[i3 + 1] = rgb[1] * dimmer
      colors[i3 + 2] = rgb[2] * dimmer

      seeds[i] = Math.random()
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
    }),
    [dpr],
  )

  useFrame(({ clock }) => {
    if (!materialRef.current) return
    // The only per-frame work: advance shader time on the GPU.
    materialRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  // Composition bias: the cloud sits slightly right of center,
  // mirroring the hero's asymmetric split.
  return (
    <points position={[0.55, 0.05, 0]} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particlesVertexShader}
        fragmentShader={particlesFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

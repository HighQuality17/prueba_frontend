import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
} from 'three'
import gsap from 'gsap'
import { particlesVertexShader, particlesFragmentShader } from './shaders/particles'
import { generateCloudPositions } from './utils/generateCloudPositions'
import { generateSpherePositions } from './utils/generateSpherePositions'

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
// Fixed seed keeps both shape targets reproducible for debugging.
const POSITION_SEED = 1337

type ColorRole = 'neutral' | 'iris' | 'saffron' | 'verdant'

function pickRole(random: () => number): ColorRole {
  const r = random()
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
      return hexToRgb(hex)
    }
    case 'iris':
      return hexToRgb(TOKEN.electricIris)
    case 'saffron':
      return hexToRgb(TOKEN.saffronSpark)
    case 'verdant':
      return hexToRgb(TOKEN.deepVerdant)
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const int = parseInt(hex.slice(1), 16)
  return [
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  ]
}

export function ParticleSystem() {
  const materialRef = useRef<ShaderMaterial>(null)

  const dpr = useThree((state) => state.viewport.dpr)

  /*
    All buffers are generated once and reused for the lifetime of the
    component; nothing is rebuilt or reallocated per frame.

    `position` holds the organic cloud target; `aPositionSphere` holds the
    Fibonacci-sphere target. Index i corresponds to the same particle in
    both arrays, so the GPU can mix() between them per vertex.
  */
  const geometry = useMemo(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP

    const cloudPositions = generateCloudPositions(count, POSITION_SEED)
    const spherePositions = generateSpherePositions(count, POSITION_SEED + 1)

    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const seeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      sizes[i] = Math.random() < 0.7 ? 0.7 + Math.random() * 0.9 : 0.45 + Math.random() * 0.5

      const rgb = roleColor(pickRole(Math.random))
      const dimmer = sizes[i] < 0.6 ? 0.55 : 1
      const i3 = i * 3
      colors[i3] = rgb[0] * dimmer
      colors[i3 + 1] = rgb[1] * dimmer
      colors[i3 + 2] = rgb[2] * dimmer

      seeds[i] = Math.random()
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(cloudPositions, 3))
    geo.setAttribute('aPositionSphere', new BufferAttribute(spherePositions, 3))
    geo.setAttribute('aColor', new BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uMorphProgress: { value: 0 },
    }),
    [dpr],
  )

  /*
    Temporary Phase 3 preview: slow cloud -> sphere -> cloud loop driven by
    a single isolated GSAP tween on uMorphProgress. Easing happens here in
    JS; the shader consumes the raw eased value. This gets replaced by
    ScrollTrigger wiring in Phase 4 — delete this effect only.
  */
  useEffect(() => {
    if (!materialRef.current) return

    const tween = gsap.to(materialRef.current.uniforms.uMorphProgress, {
      value: 1,
      duration: 4,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      repeatDelay: 1,
    })

    return () => {
      tween.kill()
    }
  }, [])

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

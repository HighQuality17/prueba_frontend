import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  TorusKnotGeometry,
} from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  particlesVertexShader,
  particlesFragmentShader,
} from './shaders/particles'
import { generateCloudPositions } from './utils/generateCloudPositions'
import { generateSpherePositions } from './utils/generateSpherePositions'
import { generateHelixPositions } from './utils/generateHelixPositions'
import { generateMeshSurfacePositions } from './utils/generateMeshSurfacePositions'

// Registered once for the module lifetime; this file owns the only
// ScrollTrigger usage in the app.
gsap.registerPlugin(ScrollTrigger)

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

    `position` holds the organic cloud target; `aPositionSphere` and
    `aPositionHelix` hold the other two shape targets. Index i corresponds
    to the same particle in every array, so the GPU can piecewise-mix
    between all three states per vertex.
  */
  const geometry = useMemo(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP

    const cloudPositions = generateCloudPositions(count, POSITION_SEED)
    const spherePositions = generateSpherePositions(count, POSITION_SEED + 1)
    const helixPositions = generateHelixPositions(count, POSITION_SEED + 2)

    // One-time mesh surface sampling: elegant torus knot, smooth enough
    // for even coverage. The source geometry is disposed after sampling.
    const knotGeometry = new TorusKnotGeometry(1.3, 0.38, 220, 32)
    const meshPositions = generateMeshSurfacePositions(
      knotGeometry,
      count,
      POSITION_SEED + 3,
    )
    knotGeometry.dispose()

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
    geo.setAttribute('aPositionHelix', new BufferAttribute(helixPositions, 3))
    geo.setAttribute('aPositionMesh', new BufferAttribute(meshPositions, 3))
    geo.setAttribute('aColor', new BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return geo
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uShapeProgress: { value: 0 },
    }),
    [dpr],
  )

  /*
    Scroll-driven multi-state morph:
      uShapeProgress 0.0 = cloud, 1.0 = sphere, 2.0 = helix.

    Two explicitly separated scroll ranges each own one segment of the
    progress scale. Both use gsap.fromTo() with pinned start values and
    immediateRender: false on the second, so the triggers can never fight
    over the uniform or reset each other's state — regardless of creation
    order or scroll direction. ease: "none" + scrub: true keep the GPU
    state in direct, reversible correspondence with scroll position.

    All triggers live inside gsap.context() so StrictMode double-mounts
    and unmounts revert exactly what this component created.
  */
  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    const ctx = gsap.context(() => {
      // Dev override: VITE_IGNORE_REDUCED_MOTION=true allows testing the
      // scroll morph locally even when the OS disables animations.
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      const ignoreReducedMotion =
        import.meta.env.VITE_IGNORE_REDUCED_MOTION === 'true'
      const shouldReduceMotion = prefersReducedMotion && !ignoreReducedMotion

      if (shouldReduceMotion) {
        // Reduced motion: hold one stable state (the organic cloud).
        material.uniforms.uShapeProgress.value = 0
        return
      }

      const shapeProgress = material.uniforms.uShapeProgress

      // Range A: cloud -> sphere across the Manifesto section approach.
      gsap.fromTo(
        shapeProgress,
        { value: 0 },
        {
          value: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '#manifesto',
            start: 'top bottom',
            end: '+=200%',
            scrub: true,
          },
        },
      )

      // Range B: sphere -> helix across the Practice section approach.
      gsap.fromTo(
        shapeProgress,
        { value: 1 },
        {
          value: 2,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: '#practice',
            start: 'top bottom',
            end: '+=150%',
            scrub: true,
          },
        },
      )

      // Range C: helix -> torus knot across the closing CTA approach.
      gsap.fromTo(
        shapeProgress,
        { value: 2 },
        {
          value: 3,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: '#join',
            start: 'top bottom',
            end: '+=160%',
            scrub: true,
          },
        },
      )

      // Single intentional refresh once webfonts settle the layout.
      document.fonts?.ready.then(() => ScrollTrigger.refresh())
    })

    return () => {
      ctx.revert()
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

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  ShaderMaterial,
} from 'three'
import {
  particlesVertexShader,
  particlesFragmentShader,
} from './shaders/particles'
import {
  createParticleShapeRegistry,
  type ParticleShapeRegistry,
} from './particleShapeRegistry'
import {
  particleEffects,
  particleMorphs,
  type ParticleMorph,
} from './timeline/experienceTimeline'
import {
  activeSegmentIndex,
  segmentProgress,
  sineCycle,
  sineSquaredEnvelope,
  singularityBurstDistance,
  singularityEnergy,
  singularityRadialScale,
  singularityScatter,
  singularitySwirl,
  singularityTurbulence,
} from './timeline/mapJourneyProgress'
import type { JourneyProgressRef } from './timeline/useJourneyScroll'

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

interface ParticleSystemProps {
  journeyProgress: JourneyProgressRef
}

function uploadMorphSegment(
  geometry: BufferGeometry,
  shapes: ParticleShapeRegistry,
  segment: ParticleMorph,
): void {
  const source = geometry.getAttribute('aPositionSource')
  const target = geometry.getAttribute('aPositionTarget')
  const sourceArray = source.array as Float32Array
  const targetArray = target.array as Float32Array

  sourceArray.set(shapes[segment.from].positions)
  targetArray.set(shapes[segment.to].positions)
  source.needsUpdate = true
  target.needsUpdate = true
}

export function ParticleSystem({ journeyProgress }: ParticleSystemProps) {
  const materialRef = useRef<ShaderMaterial>(null)

  const dpr = useThree((state) => state.viewport.dpr)
  const canvasWidth = useThree((state) => state.size.width)
  // Select once so viewport resizes never regenerate particle buffers.
  const particleCountRef = useRef(
    canvasWidth <= 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP,
  )
  const particleCount = particleCountRef.current
  const activeSegmentRef = useRef(0)

  const shapes = useMemo(
    () => createParticleShapeRegistry(particleCount, POSITION_SEED),
    [particleCount],
  )

  /*
    The CPU registry retains every generated shape, while the GPU geometry
    exposes only the active source and target. Segment changes copy cached
    arrays into these two attributes; ordinary scrolling changes uniforms.
  */
  const geometry = useMemo(() => {
    const count = particleCount
    const initialSegment = particleMorphs[0]
    const sourcePositions = new Float32Array(
      shapes[initialSegment.from].positions,
    )
    const targetPositions = new Float32Array(
      shapes[initialSegment.to].positions,
    )

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
    geo.setAttribute(
      'aPositionSource',
      new BufferAttribute(sourcePositions, 3).setUsage(DynamicDrawUsage),
    )
    geo.setAttribute(
      'aPositionTarget',
      new BufferAttribute(targetPositions, 3).setUsage(DynamicDrawUsage),
    )
    geo.setAttribute('aColor', new BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    // There is intentionally no built-in `position` attribute; an explicit
    // draw range lets Three.js draw from the two custom position attributes.
    geo.setDrawRange(0, count)
    return geo
  }, [particleCount, shapes])

  const uniforms = useMemo(() => {
    const initialSegment = particleMorphs[0]
    const sourceShape = shapes[initialSegment.from]
    const targetShape = shapes[initialSegment.to]

    return {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uMorphProgress: { value: 0 },
      uRadialScale: { value: 1 },
      uDistortionStrength: { value: 0 },
      uDistortionPhase: { value: 0 },
      uBurstDistance: { value: 0 },
      uBurstScatter: { value: 0 },
      uBurstSwirl: { value: 0 },
      uBurstTurbulence: { value: 0 },
      uBurstPhase: { value: 0 },
      uEnergyIntensity: { value: 0 },
      uSourceMotionAmplitude: { value: sourceShape.motionAmplitude },
      uTargetMotionAmplitude: { value: targetShape.motionAmplitude },
      uSourceRotationAmount: { value: sourceShape.rotationAmount },
      uTargetRotationAmount: { value: targetShape.rotationAmount },
    }
  }, [shapes])

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return

    const journey = journeyProgress.current
    const segmentIndex = activeSegmentIndex(journey, particleMorphs)

    if (segmentIndex !== activeSegmentRef.current) {
      const segment = particleMorphs[segmentIndex]
      const sourceShape = shapes[segment.from]
      const targetShape = shapes[segment.to]

      uploadMorphSegment(geometry, shapes, segment)
      material.uniforms.uSourceMotionAmplitude.value =
        sourceShape.motionAmplitude
      material.uniforms.uTargetMotionAmplitude.value =
        targetShape.motionAmplitude
      material.uniforms.uSourceRotationAmount.value = sourceShape.rotationAmount
      material.uniforms.uTargetRotationAmount.value = targetShape.rotationAmount
      activeSegmentRef.current = segmentIndex
    }

    const activeSegment = particleMorphs[segmentIndex]
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uMorphProgress.value = segmentProgress(
      journey,
      activeSegment,
    )
    const radialEffect = particleEffects.fibonacciBreath
    const fibonacciBreathProgress = segmentProgress(journey, radialEffect)
    const fibonacciScale =
      1 + radialEffect.amplitude * sineCycle(fibonacciBreathProgress)

    const distortionEffect = particleEffects.sphereFractalDistortion
    const distortionProgress = segmentProgress(journey, distortionEffect)
    material.uniforms.uDistortionStrength.value =
      distortionEffect.maxStrength *
      sineSquaredEnvelope(distortionProgress)
    material.uniforms.uDistortionPhase.value = distortionProgress

    const singularityEffect = particleEffects.singularityBurst
    const singularityProgress = segmentProgress(journey, singularityEffect)
    material.uniforms.uRadialScale.value =
      fibonacciScale *
      singularityRadialScale(singularityProgress, singularityEffect)
    material.uniforms.uBurstDistance.value = singularityBurstDistance(
      singularityProgress,
      singularityEffect,
    )
    material.uniforms.uBurstScatter.value = singularityScatter(
      singularityProgress,
      singularityEffect,
    )
    material.uniforms.uBurstSwirl.value = singularitySwirl(
      singularityProgress,
      singularityEffect,
    )
    material.uniforms.uBurstTurbulence.value = singularityTurbulence(
      singularityProgress,
      singularityEffect,
    )
    material.uniforms.uBurstPhase.value = singularityProgress
    material.uniforms.uEnergyIntensity.value = singularityEnergy(
      singularityProgress,
      singularityEffect,
    )
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

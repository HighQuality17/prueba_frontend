import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  Vector2,
} from 'three'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import {
  sacredGeometryFragmentShader,
  sacredGeometryVertexShader,
} from './sacredGeometryShader'

const MOBILE_BREAKPOINT = 768
const FULLSCREEN_TRIANGLE = new Float32Array([
  -1, -1, 0,
  3, -1, 0,
  -1, 3, 0,
])

interface SacredGeometryFieldProps {
  journeyProgress: JourneyProgressRef
}

export function SacredGeometryField({
  journeyProgress,
}: SacredGeometryFieldProps) {
  const materialRef = useRef<ShaderMaterial>(null)
  const canvasWidth = useThree((state) => state.size.width)
  const canvasHeight = useThree((state) => state.size.height)
  const dpr = useThree((state) => state.viewport.dpr)
  const isMobileRef = useRef(canvasWidth <= MOBILE_BREAKPOINT)

  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(FULLSCREEN_TRIANGLE, 3))
    return result
  }, [])

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new Vector2(1, 1) },
      uBirth: { value: 0 },
      uIntegration: { value: 0 },
      uExpansion: { value: 0 },
      uBloom: { value: 0 },
      uTiger: { value: 0 },
      uSerpent: { value: 0 },
      uEagle: { value: 0 },
      uFinal: { value: 0 },
      uDetail: { value: isMobileRef.current ? 0 : 1 },
    }),
    [],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) return

    const journey = journeyProgress.current
    const stages = worldEffects.sacredGeometry.stages
    material.visible = journey >= worldEffects.sacredGeometry.start
    if (!material.visible) return

    const birth = smootherstep01(segmentProgress(journey, stages.birth))
    const integration = smootherstep01(
      segmentProgress(journey, stages.eyeIntegration),
    )
    const expansion = smootherstep01(
      segmentProgress(journey, stages.expansion),
    )
    const bloom = smootherstep01(segmentProgress(journey, stages.fullBloom))
    const tigerIn = smootherstep01(segmentProgress(journey, stages.tiger))
    const serpentIn = smootherstep01(segmentProgress(journey, stages.serpent))
    const eagleIn = smootherstep01(segmentProgress(journey, stages.eagle))
    const finalHold = smootherstep01(
      segmentProgress(journey, stages.finalHold),
    )

    const u = material.uniforms
    ;(u.uResolution.value as Vector2).set(canvasWidth * dpr, canvasHeight * dpr)
    u.uBirth.value = birth
    u.uIntegration.value = integration
    u.uExpansion.value = expansion
    u.uBloom.value = bloom
    u.uTiger.value = tigerIn * (1 - serpentIn)
    u.uSerpent.value = serpentIn * (1 - eagleIn)
    u.uEagle.value = eagleIn
    u.uFinal.value = finalHold
  })

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={8}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={sacredGeometryVertexShader}
        fragmentShader={sacredGeometryFragmentShader}
        uniforms={uniforms}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

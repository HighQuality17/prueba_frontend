import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  Vector2,
} from 'three'
import { worldEffects } from '../timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
  smoothstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'

const FULLSCREEN_TRIANGLE = new Float32Array([
  -1, -1, 0,
  3, -1, 0,
  -1, 3, 0,
])

const APERTURE_MAX = 2.6

const revealVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const revealDarkenFragmentShader = /* glsl */ `
uniform vec2 uResolution;
uniform float uReveal;
uniform float uOpacity;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  float radius = length(uv);
  float aperture = mix(0.0, ${APERTURE_MAX.toFixed(1)}, uReveal);
  float aa = max(fwidth(radius) * 1.5, 1.0 / uResolution.y);
  float mask = 1.0 - smoothstep(
    aperture * 0.72 - aa,
    aperture + aa,
    radius
  );
  float alpha = uOpacity * (1.0 - mask);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`

const revealGlowFragmentShader = /* glsl */ `
uniform vec2 uResolution;
uniform float uReveal;
uniform float uOpacity;
uniform float uColorPhase;

#define TWO_PI 6.28318530718

vec3 cosinePalette(float t) {
  return vec3(0.38, 0.32, 0.45)
    + vec3(0.45, 0.38, 0.45) * cos(TWO_PI * (t + vec3(0.82, 0.58, 0.34)));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  float radius = length(uv);
  float aperture = mix(0.0, ${APERTURE_MAX.toFixed(1)}, uReveal);
  float edgeGlow = exp(-abs(radius - aperture) * 6.0)
    * (1.0 - uReveal) * step(0.001, aperture);
  vec3 color = cosinePalette(uColorPhase * 2.0 + radius * 0.4);
  gl_FragColor = vec4(color, edgeGlow * uOpacity * 0.35);
}
`

interface TunnelRevealMaskProps {
  journeyProgress: JourneyProgressRef
}

/*
  Radial portal reveal lifted from the legacy shader into a cheap fullscreen
  pass. The darkening quad hides everything outside the growing aperture, and
  an additive quad restores the shimmering edge glow.
*/
export function TunnelRevealMask({ journeyProgress }: TunnelRevealMaskProps) {
  const gl = useThree((state) => state.gl)
  const darkenRef = useRef<ShaderMaterial>(null)
  const glowRef = useRef<ShaderMaterial>(null)
  const drawingBufferSize = useMemo(() => new Vector2(), [])

  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute(
      'position',
      new BufferAttribute(FULLSCREEN_TRIANGLE, 3),
    )
    return geo
  }, [])

  const darkenUniforms = useMemo(
    () => ({
      uResolution: { value: new Vector2(1, 1) },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  )

  const glowUniforms = useMemo(
    () => ({
      uResolution: { value: new Vector2(1, 1) },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uColorPhase: { value: 0 },
    }),
    [],
  )

  useFrame(() => {
    const darken = darkenRef.current
    const glow = glowRef.current
    if (!darken || !glow) return

    const journey = journeyProgress.current
    const tunnel = worldEffects.tunnel
    const local = segmentProgress(journey, tunnel)
    const revealRaw = Math.min(1, Math.max(0, local / tunnel.revealFraction))
    const reveal = smootherstep01(revealRaw)
    const tunnelFade = smootherstep01(
      segmentProgress(journey, worldEffects.sacredGeometry.stages.eyeIntegration),
    )
    const opacity = smoothstep01(revealRaw) * (1 - tunnelFade)

    gl.getDrawingBufferSize(drawingBufferSize)
    const active = opacity > 0.0005
    darken.visible = active
    glow.visible = active
    if (!active) return

    ;(darkenUniforms.uResolution.value as Vector2).copy(drawingBufferSize)
    ;(glowUniforms.uResolution.value as Vector2).copy(drawingBufferSize)
    darkenUniforms.uReveal.value = reveal
    darkenUniforms.uOpacity.value = opacity
    glowUniforms.uReveal.value = reveal
    glowUniforms.uOpacity.value = opacity
    glowUniforms.uColorPhase.value = local * 0.65
  })

  return (
    <>
      <mesh geometry={geometry} frustumCulled={false} renderOrder={10}>
        <shaderMaterial
          ref={darkenRef}
          vertexShader={revealVertexShader}
          fragmentShader={revealDarkenFragmentShader}
          uniforms={darkenUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geometry} frustumCulled={false} renderOrder={11}>
        <shaderMaterial
          ref={glowRef}
          vertexShader={revealVertexShader}
          fragmentShader={revealGlowFragmentShader}
          uniforms={glowUniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </>
  )
}

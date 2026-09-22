import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import {
  HalfFloatType,
  type Camera,
  type Material,
  type Scene,
  Vector2,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import {
  BlendFunction,
  BloomEffect,
  EffectComposer as EffectComposerImpl,
  ChromaticAberrationEffect,
  EffectPass,
  KernelSize,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing'
import { postEffects } from '../timeline/experienceTimeline'
import {
  chromaticAberrationDirection,
  chromaticAberrationOffset,
  tunnelBloomIntensity,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'
import type { RenderQualityProfile } from '../renderQuality'
import { schedulePrewarmTasks } from '../schedulePrewarmTasks'
import {
  beginPreparation,
  completePreparation,
  failPreparation,
  logTunnelPerf,
  type TunnelPreparationState,
} from '../tunnelPerformance'

const BLOOM_LUMINANCE_THRESHOLD = 1.1
const BLOOM_LUMINANCE_SMOOTHING = 0.08
const BLOOM_RADIUS = 0.72
const MOBILE_BLOOM_LUMINANCE_SCALE = 0.5
const ABERRATION_MODULATION_OFFSET = 0.22
// StrictMode replays effects without recreating memoized passes.
const pendingDisposals = new WeakMap<object, number>()

interface JourneyPostProcessingProps {
  journeyProgress: JourneyProgressRef
  quality: RenderQualityProfile
  preparation: TunnelPreparationState
  debugPerf: boolean
}

interface PostProcessingResources {
  bloom: BloomEffect | null
  bloomPass: EffectPass | null
  outputPass: EffectPass | null
}

interface JourneyPassProps extends JourneyPostProcessingProps {
  resources: MutableRefObject<PostProcessingResources>
}

interface CompilablePass {
  scene: Scene
  camera: Camera
  fullscreenMaterial: Material
}

interface BloomPrewarmInternals {
  renderTarget: WebGLRenderTarget
  luminancePass: CompilablePass & {
    renderTarget: WebGLRenderTarget
  }
  mipmapBlurPass: CompilablePass & {
    downsamplingMaterial: Material
    upsamplingMaterial: Material
    downsamplingMipmaps: WebGLRenderTarget[]
    upsamplingMipmaps: WebGLRenderTarget[]
  }
  blurPass: CompilablePass & {
    blurMaterial: Material
    copyMaterial: Material
    renderTargetA: WebGLRenderTarget
    renderTargetB: WebGLRenderTarget
  }
}

function compilePass(
  gl: WebGLRenderer,
  pass: CompilablePass,
  material?: Material,
): Promise<unknown> {
  if (material) pass.fullscreenMaterial = material
  return gl.compileAsync(pass.scene, pass.camera)
}

function getBloomRenderTargets(
  bloom: BloomEffect,
  quality: RenderQualityProfile,
): WebGLRenderTarget[] {
  const internals = bloom as unknown as BloomPrewarmInternals
  const targets = quality.bloomMipmap
    ? [
        internals.luminancePass.renderTarget,
        ...internals.mipmapBlurPass.downsamplingMipmaps,
        ...internals.mipmapBlurPass.upsamplingMipmaps,
      ]
    : [
        internals.luminancePass.renderTarget,
        internals.renderTarget,
        internals.blurPass.renderTargetA,
        internals.blurPass.renderTargetB,
      ]
  return [...new Set(targets)]
}

function initializePostTargets(
  gl: WebGLRenderer,
  composer: EffectComposerImpl,
  bloom: BloomEffect | null,
  quality: RenderQualityProfile,
): void {
  gl.initRenderTarget(composer.inputBuffer)
  gl.initRenderTarget(composer.outputBuffer)
  if (bloom) {
    getBloomRenderTargets(bloom, quality).forEach((target) => {
      gl.initRenderTarget(target)
    })
  }
}

function warmPostProcessing(
  gl: WebGLRenderer,
  composer: EffectComposerImpl,
  bloomPass: EffectPass,
  outputPass: EffectPass,
): void {
  const previousRenderTarget = gl.getRenderTarget()
  const bloomPassState = bloomPass as unknown as { rtt: boolean }
  const outputPassState = outputPass as unknown as { rtt: boolean }
  const bloomRtt = bloomPassState.rtt
  const outputRtt = outputPassState.rtt

  try {
    // Bypass the public setter so the offscreen warmup doesn't mark either
    // already-compiled EffectMaterial for recompilation.
    bloomPassState.rtt = true
    outputPassState.rtt = true
    bloomPass.render(gl, composer.inputBuffer, composer.outputBuffer, 0, false)
    outputPass.render(gl, composer.outputBuffer, composer.inputBuffer, 0, false)
  } finally {
    bloomPassState.rtt = bloomRtt
    outputPassState.rtt = outputRtt
    gl.setRenderTarget(previousRenderTarget)
  }
}

function useDeferredDisposal(resource: { dispose: () => void }): void {
  useEffect(() => {
    const pendingDisposal = pendingDisposals.get(resource)
    if (pendingDisposal !== undefined) {
      globalThis.clearTimeout(pendingDisposal)
      pendingDisposals.delete(resource)
    }

    return () => {
      const timeout = globalThis.setTimeout(() => {
        if (pendingDisposals.get(resource) !== timeout) return
        pendingDisposals.delete(resource)
        resource.dispose()
      }, 0)
      pendingDisposals.set(resource, timeout)
    }
  }, [resource])
}

function JourneyBloomPass({
  journeyProgress,
  quality,
  resources,
}: JourneyPassProps) {
  const camera = useThree((state) => state.camera)
  const [bloom, bloomPass] = useMemo(() => {
    const effect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      intensity: 0,
      luminanceThreshold: BLOOM_LUMINANCE_THRESHOLD,
      luminanceSmoothing: BLOOM_LUMINANCE_SMOOTHING,
      mipmapBlur: quality.bloomMipmap,
      radius: BLOOM_RADIUS,
      levels: quality.bloomLevels,
      kernelSize: quality.isMobile ? KernelSize.SMALL : KernelSize.LARGE,
      resolutionScale: quality.bloomResolutionScale,
    })
    if (!quality.chromaticAberrationEnabled) {
      effect.luminancePass.resolution.scale = MOBILE_BLOOM_LUMINANCE_SCALE
    }
    const pass = new EffectPass(camera, effect)
    pass.enabled = false

    return [effect, pass] as const
  }, [camera, quality])

  resources.current.bloom = bloom
  resources.current.bloomPass = bloomPass

  useDeferredDisposal(bloomPass)

  useFrame(() => {
    const intensity = tunnelBloomIntensity(
      journeyProgress.current,
      postEffects.tunnelBloom,
    )
    bloom.intensity = intensity
    // Avoid the luminance and mip-chain draws before the portal opens.
    bloomPass.enabled = intensity > 0.0001
  }, -10)

  return <primitive object={bloomPass} />
}

function OptionalJourneyBloomPass(props: JourneyPassProps) {
  return props.quality.bloomEnabled ? <JourneyBloomPass {...props} /> : null
}

function JourneyColorOutputPass({
  journeyProgress,
  quality,
  resources,
}: JourneyPassProps) {
  const camera = useThree((state) => state.camera)
  const [aberration, outputPass] = useMemo(() => {
    const toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    })

    if (quality.isMobile) {
      return [null, new EffectPass(camera, toneMapping)] as const
    }

    const chromaticAberration = new ChromaticAberrationEffect({
      offset: new Vector2(),
      radialModulation: true,
      modulationOffset: ABERRATION_MODULATION_OFFSET,
    })

    // Chromatic aberration and ACES share this single final fullscreen pass.
    return [
      chromaticAberration,
      new EffectPass(camera, chromaticAberration, toneMapping),
    ] as const
  }, [camera, quality])

  resources.current.outputPass = outputPass
  useDeferredDisposal(outputPass)

  useFrame(() => {
    if (!aberration) return

    const effect = postEffects.chromaticAberration
    const magnitude = chromaticAberrationOffset(
      journeyProgress.current,
      effect,
    )
    const direction = chromaticAberrationDirection(
      journeyProgress.current,
      effect,
    )

    aberration.offset.set(
      Math.cos(direction) * magnitude,
      Math.sin(direction) * magnitude,
    )
  }, -10)

  return <primitive object={outputPass} />
}

export function JourneyPostProcessing({
  journeyProgress,
  quality,
  preparation,
  debugPerf,
}: JourneyPostProcessingProps) {
  const composerRef = useRef<EffectComposerImpl>(null)
  const lastComposerSizeRef = useRef({ width: -1, height: -1 })
  const composerResizeCountRef = useRef(0)
  const drawingBufferSize = useMemo(() => new Vector2(), [])
  const resources = useRef<PostProcessingResources>({
    bloom: null,
    bloomPass: null,
    outputPass: null,
  })

  useEffect(() => {
    let active = true
    const scheduled = schedulePrewarmTasks([
      async () => {
        const composer = composerRef.current
        const { bloom, bloomPass, outputPass } = resources.current
        if (
          !composer ||
          !outputPass ||
          (quality.bloomEnabled && (!bloom || !bloomPass))
        ) {
          throw new Error('Postprocessing resources are not mounted')
        }

        beginPreparation(preparation, 'postprocessing', composer.getRenderer(), debugPerf)
        const gl = composer.getRenderer()
        if (bloom && bloomPass) {
          const internals = bloom as unknown as BloomPrewarmInternals
          await compilePass(gl, bloomPass as unknown as CompilablePass)
          if (!active) return
          await compilePass(gl, internals.luminancePass)
          if (!active) return

          if (quality.bloomMipmap) {
            await compilePass(
              gl,
              internals.mipmapBlurPass,
              internals.mipmapBlurPass.downsamplingMaterial,
            )
            if (!active) return
            await compilePass(
              gl,
              internals.mipmapBlurPass,
              internals.mipmapBlurPass.upsamplingMaterial,
            )
          } else {
            await compilePass(
              gl,
              internals.blurPass,
              internals.blurPass.blurMaterial,
            )
            if (!active) return
            await compilePass(
              gl,
              internals.blurPass,
              internals.blurPass.copyMaterial,
            )
          }
        }

        if (!active) return
        await compilePass(gl, outputPass as unknown as CompilablePass)
        if (!active) return
        initializePostTargets(gl, composer, bloom, quality)
        if (bloomPass) {
          warmPostProcessing(gl, composer, bloomPass, outputPass)
        }
      },
    ])
    scheduled.promise
      .then(() => {
        const composer = composerRef.current
        if (active && composer) {
          completePreparation(
            preparation,
            'postprocessing',
            composer.getRenderer(),
            debugPerf,
          )
        }
      })
      .catch((error: unknown) => {
        if (active) {
          failPreparation(preparation, 'postprocessing', error, debugPerf)
        }
      })

    return () => {
      active = false
      scheduled.cancel()
    }
  }, [debugPerf, preparation, quality])

  useFrame((state) => {
    const composer = composerRef.current
    if (!composer) return

    state.gl.getDrawingBufferSize(drawingBufferSize)
    const lastSize = lastComposerSizeRef.current
    if (
      lastSize.width === drawingBufferSize.x &&
      lastSize.height === drawingBufferSize.y
    ) {
      return
    }

    const resizeStart = performance.now()
    lastSize.width = drawingBufferSize.x
    lastSize.height = drawingBufferSize.y
    composer.setSize(state.size.width, state.size.height)
    initializePostTargets(state.gl, composer, resources.current.bloom, quality)
    composerResizeCountRef.current += 1
    preparation.diagnostics.composerResizes += 1
    if (debugPerf) {
      const markName = `tunnel-perf:composer-resize:${composerResizeCountRef.current}`
      performance.mark(`${markName}:start`, { startTime: resizeStart })
      performance.mark(`${markName}:end`)
      performance.measure(markName, {
        start: `${markName}:start`,
        end: `${markName}:end`,
      })
    }
    logTunnelPerf(debugPerf, 'composer-resize', {
      dpr: state.viewport.dpr,
      drawingBuffer: [drawingBufferSize.x, drawingBufferSize.y],
      cpuDurationMs: Number((performance.now() - resizeStart).toFixed(2)),
    })
  }, -80)

  return (
    <EffectComposer
      ref={composerRef}
      depthBuffer={false}
      multisampling={0}
      frameBufferType={HalfFloatType}
    >
      <OptionalJourneyBloomPass
        journeyProgress={journeyProgress}
        quality={quality}
        preparation={preparation}
        debugPerf={debugPerf}
        resources={resources}
      />
      <JourneyColorOutputPass
        journeyProgress={journeyProgress}
        quality={quality}
        preparation={preparation}
        debugPerf={debugPerf}
        resources={resources}
      />
    </EffectComposer>
  )
}

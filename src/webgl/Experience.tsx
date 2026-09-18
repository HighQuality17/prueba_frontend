import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector2 } from 'three'
import { ParticleSystem } from './ParticleSystem'
import { CAMERA_BASELINE, CameraRig } from './camera/CameraRig'
import { SacredGeometryField } from './geometry/SacredGeometryField'
import { JourneyPostProcessing } from './postprocessing/JourneyPostProcessing'
import { ProceduralTunnel } from './tunnel/ProceduralTunnel'
import { useParticlePointer } from './useParticlePointer'
import { detectRenderQuality } from './renderQuality'
import type { RenderQualityProfile } from './renderQuality'
import { worldEffects } from './timeline/experienceTimeline'
import type { JourneyProgressRef } from './timeline/journeyProgress'
import { getPendingPrewarmTaskCount } from './schedulePrewarmTasks'
import {
  createTunnelPreparationState,
  isTunnelPerfDebugEnabled,
  logTunnelPerf,
  rendererProgramCount,
  type TunnelPreparationState,
} from './tunnelPerformance'
import {
  advanceJourneyScroll,
  publishJourneyProgress,
  useJourneyScroll,
} from './timeline/useJourneyScroll'

const JOURNEY_DAMPING = 7
const ENDPOINT_EPSILON = 0.00001
const SETTLE_EPSILON = 0.000001
const TARGET_RENDER_FPS = 60
const TARGET_FRAME_INTERVAL_MS = 1000 / TARGET_RENDER_FPS
const TUNNEL_DPR_PRELOAD_MARGIN = 0.025

function RenderCadenceController() {
  const advance = useThree((state) => state.advance)

  useEffect(() => {
    let animationFrameId = 0
    let startTime: number | null = null
    let previousRafTime: number | null = null
    let accumulatedTime = 0

    const tick = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(tick)
      advanceJourneyScroll(timestamp)

      if (startTime === null || previousRafTime === null) {
        startTime = timestamp
        previousRafTime = timestamp
        advance(0)
        return
      }

      accumulatedTime += timestamp - previousRafTime
      previousRafTime = timestamp

      if (accumulatedTime < TARGET_FRAME_INTERVAL_MS) return

      // Preserve sub-frame excess without issuing catch-up render bursts.
      accumulatedTime %= TARGET_FRAME_INTERVAL_MS
      advance((timestamp - startTime) / 1000)
    }

    animationFrameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animationFrameId)
  }, [advance])

  return null
}

interface JourneyProgressSmootherProps {
  rawProgress: JourneyProgressRef
  visualProgress: JourneyProgressRef
}

function JourneyProgressSmoother({
  rawProgress,
  visualProgress,
}: JourneyProgressSmootherProps) {
  const lastPublishedProgress = useRef(-1)

  useFrame((_, delta) => {
    const raw = rawProgress.current
    const target =
      raw <= ENDPOINT_EPSILON
        ? 0
        : raw >= 1 - ENDPOINT_EPSILON
          ? 1
          : raw
    const next = MathUtils.damp(
      visualProgress.current,
      target,
      JOURNEY_DAMPING,
      delta,
    )

    const visual = Math.abs(next - target) <= SETTLE_EPSILON ? target : next
    visualProgress.current = visual

    if (Math.abs(visual - lastPublishedProgress.current) > SETTLE_EPSILON) {
      lastPublishedProgress.current = visual
      publishJourneyProgress(visual)
    }
  }, -100)

  return null
}

interface TunnelDprControllerProps {
  rawProgress: JourneyProgressRef
  journeyProgress: JourneyProgressRef
  quality: RenderQualityProfile
  debugPerf: boolean
}

function TunnelDprController({
  rawProgress,
  journeyProgress,
  quality,
  debugPerf,
}: TunnelDprControllerProps) {
  const setDpr = useThree((state) => state.setDpr)
  const get = useThree((state) => state.get)
  const currentDpr = useThree((state) => state.viewport.dpr)
  const normalDprRef = useRef(currentDpr)
  const tunnelDprActiveRef = useRef(false)
  const dprChangeCountRef = useRef(0)
  const drawingBufferSize = useMemo(() => new Vector2(), [])

  useFrame(() => {
    if (!quality.isMobile) return

    const journey = journeyProgress.current
    const target = rawProgress.current
    const tunnelStart = worldEffects.tunnel.start
    const tunnelEnd = worldEffects.sacredGeometry.stages.eyeIntegration.end
    const preloadStart = Math.max(0, tunnelStart - TUNNEL_DPR_PRELOAD_MARGIN)
    const preloadEnd = Math.min(1, tunnelEnd + TUNNEL_DPR_PRELOAD_MARGIN)
    const visualInside =
      journey > preloadStart && journey < preloadEnd
    const approachingForward =
      target > journey && journey < preloadEnd && target > preloadStart
    const approachingReverse =
      target < journey && journey > preloadStart && target < preloadEnd
    const shouldEnter =
      visualInside || approachingForward || approachingReverse
    const shouldExit =
      (target <= preloadStart && journey <= preloadStart) ||
      (target >= preloadEnd && journey >= preloadEnd)

    if (!tunnelDprActiveRef.current && shouldEnter) {
      normalDprRef.current = get().viewport.dpr
      tunnelDprActiveRef.current = true
      const nextDpr = Math.min(normalDprRef.current, quality.tunnelDpr)
      setDpr(nextDpr)
      get().gl.getDrawingBufferSize(drawingBufferSize)
      dprChangeCountRef.current += 1
      if (debugPerf) {
        performance.mark(`tunnel-perf:dpr:${dprChangeCountRef.current}`)
      }
      logTunnelPerf(debugPerf, 'dpr-change', {
        reason: 'tunnel-preload',
        from: normalDprRef.current,
        to: nextDpr,
        rawProgress: target,
        visualProgress: journey,
        drawingBuffer: [drawingBufferSize.x, drawingBufferSize.y],
      })
    } else if (tunnelDprActiveRef.current && shouldExit) {
      tunnelDprActiveRef.current = false
      setDpr(normalDprRef.current)
      get().gl.getDrawingBufferSize(drawingBufferSize)
      dprChangeCountRef.current += 1
      if (debugPerf) {
        performance.mark(`tunnel-perf:dpr:${dprChangeCountRef.current}`)
      }
      logTunnelPerf(debugPerf, 'dpr-change', {
        reason: 'tunnel-release',
        to: normalDprRef.current,
        rawProgress: target,
        visualProgress: journey,
        drawingBuffer: [drawingBufferSize.x, drawingBufferSize.y],
      })
    }
  }, -90)

  useEffect(
    () => () => {
      if (tunnelDprActiveRef.current) setDpr(normalDprRef.current)
    },
    [setDpr],
  )

  return null
}

interface TunnelFrameDiagnosticsProps {
  journeyProgress: JourneyProgressRef
  preparation: TunnelPreparationState
}

function TunnelFrameDiagnostics({
  journeyProgress,
  preparation,
}: TunnelFrameDiagnosticsProps) {
  const wasVisibleRef = useRef(false)
  const activeMeasureRef = useRef<string | null>(null)
  const entryCountRef = useRef(0)

  useFrame(({ gl }) => {
    const journey = journeyProgress.current
    const tunnel = worldEffects.tunnel
    const revealThreshold =
      tunnel.start +
      (tunnel.end - tunnel.start) * tunnel.revealFraction * 0.0005
    const visible =
      journey > revealThreshold &&
      journey < worldEffects.sacredGeometry.stages.eyeIntegration.end

    if (visible && !wasVisibleRef.current) {
      entryCountRef.current += 1
      const markName = `tunnel-perf:entry:${entryCountRef.current}`
      activeMeasureRef.current = markName
      performance.mark(`${markName}:start`)
      logTunnelPerf(true, 'tunnel-entry', {
        entry: entryCountRef.current,
        visualProgress: journey,
        tunnelPreparation: preparation.tunnel.status,
        postPreparation: preparation.postprocessing.status,
        pendingPrewarmTasks: getPendingPrewarmTaskCount(),
        programsBefore: rendererProgramCount(gl),
      })
    }
    wasVisibleRef.current = visible
  }, -95)

  useFrame(({ gl }) => {
    const markName = activeMeasureRef.current
    if (!markName) return

    activeMeasureRef.current = null
    performance.mark(`${markName}:end`)
    const measure = performance.measure(markName, {
      start: `${markName}:start`,
      end: `${markName}:end`,
    })
    logTunnelPerf(true, 'tunnel-entry-render', {
      entry: entryCountRef.current,
      cpuDurationMs: Number(measure.duration.toFixed(2)),
      programsAfter: rendererProgramCount(gl),
      note: 'CPU submission time; this is not GPU time.',
    })
  }, 2)

  return null
}

/**
 * Fixed WebGL layer that lives behind all HTML content.
 * - pointer-events-none so the UI stays fully interactive
 * - z-index 0 while page content renders above (z-10)
 * - DPR capped for performance on high-density screens
 */
export function Experience() {
  const rawJourneyProgress = useJourneyScroll()
  const visualJourneyProgress = useRef(0)
  const pointer = useParticlePointer()
  const [quality] = useState(detectRenderQuality)
  const [debugPerf] = useState(isTunnelPerfDebugEnabled)
  const [preparation] = useState(createTunnelPreparationState)

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        frameloop="never"
        camera={{
          position: [
            CAMERA_BASELINE.position.x,
            CAMERA_BASELINE.position.y,
            CAMERA_BASELINE.position.z,
          ],
          rotation: [
            CAMERA_BASELINE.rotation.x,
            CAMERA_BASELINE.rotation.y,
            CAMERA_BASELINE.rotation.z,
          ],
          fov: CAMERA_BASELINE.fov,
        }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <RenderCadenceController />
        <JourneyProgressSmoother
          rawProgress={rawJourneyProgress}
          visualProgress={visualJourneyProgress}
        />
        <TunnelDprController
          rawProgress={rawJourneyProgress}
          journeyProgress={visualJourneyProgress}
          quality={quality}
          debugPerf={debugPerf}
        />
        <CameraRig
          journeyProgress={visualJourneyProgress}
          pointer={pointer}
        />
        <ProceduralTunnel
          journeyProgress={visualJourneyProgress}
          quality={quality}
          preparation={preparation}
          debugPerf={debugPerf}
        />
        <ParticleSystem
          journeyProgress={visualJourneyProgress}
          pointer={pointer}
        />
        <SacredGeometryField journeyProgress={visualJourneyProgress} />
        <JourneyPostProcessing
          journeyProgress={visualJourneyProgress}
          quality={quality}
          preparation={preparation}
          debugPerf={debugPerf}
        />
        {debugPerf && (
          <TunnelFrameDiagnostics
            journeyProgress={visualJourneyProgress}
            preparation={preparation}
          />
        )}
      </Canvas>
    </div>
  )
}

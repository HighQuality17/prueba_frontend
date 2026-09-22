import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Vector2 } from 'three'
import { ParticleSystem } from './ParticleSystem'
import { CAMERA_BASELINE, CameraRig } from './camera/CameraRig'
import { SacredGeometryField } from './geometry/SacredGeometryField'
import { JourneyPostProcessing } from './postprocessing/JourneyPostProcessing'
import { AlienEye } from './tunnel/AlienEye'
import { ProceduralTunnel } from './tunnel/ProceduralTunnel'
import { TunnelRevealMask } from './tunnel/TunnelRevealMask'
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

interface TunnelFrameDiagnosticsProps {
  journeyProgress: JourneyProgressRef
  preparation: TunnelPreparationState
  quality: RenderQualityProfile
}

function TunnelFrameDiagnostics({
  journeyProgress,
  preparation,
  quality,
}: TunnelFrameDiagnosticsProps) {
  const gl = useThree((state) => state.gl)
  const wasVisibleRef = useRef(false)
  const activeMeasureRef = useRef<string | null>(null)
  const entryCountRef = useRef(0)
  const intervals = useMemo(() => new Float64Array(4096), [])
  const intervalCountRef = useRef(0)
  const intervalIndexRef = useRef(0)
  const intervalsOver33Ref = useRef(0)
  const intervalsOver50Ref = useRef(0)
  const previousRenderTimeRef = useRef<number | null>(null)
  const summaryPendingRef = useRef(false)
  const summarizedDprChangesRef = useRef(0)
  const summarizedComposerResizesRef = useRef(0)
  const profileLoggedRef = useRef(false)
  const summaryDrawingBufferSize = useMemo(() => new Vector2(), [])

  useEffect(() => {
    if (profileLoggedRef.current) return
    profileLoggedRef.current = true
    gl.getDrawingBufferSize(summaryDrawingBufferSize)
    logTunnelPerf(true, 'profile', {
      profile: quality.name,
      forcedMobileEconomy:
        new URLSearchParams(window.location.search).get('forceMobileEconomy') ===
        '1',
      tunnelAngularSegments: quality.tunnelAngularSegments,
      tunnelCells: quality.tunnelCells,
      tunnelLayers: quality.tunnelLayers,
      currentDpr: gl.getPixelRatio(),
      drawingBuffer: [
        summaryDrawingBufferSize.x,
        summaryDrawingBufferSize.y,
      ],
      bloomActive: quality.bloomEnabled,
      chromaticAberrationActive: quality.chromaticAberrationEnabled,
    })
  }, [gl, quality, summaryDrawingBufferSize])

  useFrame(({ gl }) => {
    const journey = journeyProgress.current
    const tunnel = worldEffects.tunnel
    const revealThreshold =
      tunnel.start +
      (tunnel.end - tunnel.start) * tunnel.revealFraction * 0.0005
    const visible =
      journey > revealThreshold &&
      journey < worldEffects.sacredGeometry.stages.eyeIntegration.end
    const renderTime = performance.now()

    if (visible && !wasVisibleRef.current) {
      entryCountRef.current += 1
      const markName = `tunnel-perf:entry:${entryCountRef.current}`
      activeMeasureRef.current = markName
      intervalCountRef.current = 0
      intervalIndexRef.current = 0
      intervalsOver33Ref.current = 0
      intervalsOver50Ref.current = 0
      previousRenderTimeRef.current = renderTime
      performance.mark(`${markName}:start`)
      gl.getDrawingBufferSize(summaryDrawingBufferSize)
      logTunnelPerf(true, 'tunnel-entry', {
        entry: entryCountRef.current,
        visualProgress: journey,
        tunnelPreparation: preparation.tunnel.status,
        postPreparation: preparation.postprocessing.status,
        pendingPrewarmTasks: getPendingPrewarmTaskCount(),
        programsBefore: rendererProgramCount(gl),
        profile: quality.name,
        tunnelAngularSegments: quality.tunnelAngularSegments,
        tunnelCells: quality.tunnelCells,
        tunnelLayers: quality.tunnelLayers,
        dpr: gl.getPixelRatio(),
        drawingBuffer: [
          summaryDrawingBufferSize.x,
          summaryDrawingBufferSize.y,
        ],
        bloomActive: quality.bloomEnabled,
        chromaticAberrationActive: quality.chromaticAberrationEnabled,
      })
    } else if (visible && previousRenderTimeRef.current !== null) {
      const interval = renderTime - previousRenderTimeRef.current
      intervals[intervalIndexRef.current] = interval
      intervalIndexRef.current = (intervalIndexRef.current + 1) % intervals.length
      intervalCountRef.current += 1
      if (interval > 33) intervalsOver33Ref.current += 1
      if (interval > 50) intervalsOver50Ref.current += 1
      previousRenderTimeRef.current = renderTime
    } else if (!visible && wasVisibleRef.current) {
      summaryPendingRef.current = true
      previousRenderTimeRef.current = null
    }
    wasVisibleRef.current = visible
  }, -95)

  useFrame(({ gl }) => {
    const markName = activeMeasureRef.current
    if (markName) {
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
    }

    if (
      !summaryPendingRef.current ||
      preparation.diagnostics.tunnelDprActive
    ) {
      return
    }
    summaryPendingRef.current = false
    const storedCount = Math.min(intervalCountRef.current, intervals.length)
    const sorted = Array.from(intervals.slice(0, storedCount)).sort(
      (a, b) => a - b,
    )
    const percentile = (ratio: number) =>
      storedCount === 0
        ? null
        : sorted[Math.min(storedCount - 1, Math.floor(storedCount * ratio))]
    const dprChanges =
      preparation.diagnostics.dprChanges - summarizedDprChangesRef.current
    const composerResizes =
      preparation.diagnostics.composerResizes -
      summarizedComposerResizesRef.current
    summarizedDprChangesRef.current = preparation.diagnostics.dprChanges
    summarizedComposerResizesRef.current =
      preparation.diagnostics.composerResizes
    logTunnelPerf(true, 'tunnel-summary', {
      entry: entryCountRef.current,
      profile: quality.name,
      observedIntervals: intervalCountRef.current,
      storedIntervals: storedCount,
      medianIntervalMs: percentile(0.5),
      p95IntervalMs: percentile(0.95),
      intervalsOver33Ms: intervalsOver33Ref.current,
      intervalsOver50Ms: intervalsOver50Ref.current,
      dprChanges,
      composerResizes,
      note: 'Observed render cadence; this is not CPU-only or GPU time.',
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
        dpr={quality.isMobile ? 1 : [1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <RenderCadenceController />
        <JourneyProgressSmoother
          rawProgress={rawJourneyProgress}
          visualProgress={visualJourneyProgress}
        />
        <CameraRig
          journeyProgress={visualJourneyProgress}
          pointer={pointer}
        />
        <AlienEye
          journeyProgress={visualJourneyProgress}
          quality={quality}
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
          quality={quality}
        />
        <SacredGeometryField journeyProgress={visualJourneyProgress} />
        <TunnelRevealMask journeyProgress={visualJourneyProgress} />
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
            quality={quality}
          />
        )}
      </Canvas>
    </div>
  )
}

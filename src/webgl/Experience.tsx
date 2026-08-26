import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { ParticleSystem } from './ParticleSystem'
import { CAMERA_BASELINE, CameraRig } from './camera/CameraRig'
import type { JourneyProgressRef } from './timeline/journeyProgress'
import { useJourneyScroll } from './timeline/useJourneyScroll'

const JOURNEY_DAMPING = 7
const ENDPOINT_EPSILON = 0.00001
const SETTLE_EPSILON = 0.000001

interface JourneyProgressSmootherProps {
  rawProgress: JourneyProgressRef
  visualProgress: JourneyProgressRef
}

function JourneyProgressSmoother({
  rawProgress,
  visualProgress,
}: JourneyProgressSmootherProps) {
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

    visualProgress.current =
      Math.abs(next - target) <= SETTLE_EPSILON ? target : next
  }, -100)

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

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
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
        <JourneyProgressSmoother
          rawProgress={rawJourneyProgress}
          visualProgress={visualJourneyProgress}
        />
        <CameraRig journeyProgress={visualJourneyProgress} />
        <ParticleSystem journeyProgress={visualJourneyProgress} />
      </Canvas>
    </div>
  )
}

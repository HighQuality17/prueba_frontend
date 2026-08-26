import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import {
  cameraEffects,
  type CameraDiveEffect,
} from '../timeline/experienceTimeline'
import {
  segmentProgress,
  smootherstep01,
} from '../timeline/mapJourneyProgress'
import type { JourneyProgressRef } from '../timeline/journeyProgress'

const DEG_TO_RAD = Math.PI / 180
const FOV_UPDATE_EPSILON = 0.0001

export const CAMERA_BASELINE = {
  position: { x: 0, y: 0, z: 5 },
  rotation: { x: 0, y: 0, z: 0 },
  fov: 45,
} as const

export const CAMERA_START_Z = CAMERA_BASELINE.position.z
export const CAMERA_PORTAL_Z = 0.12
// Sphere points reach roughly z = -1.84, so this settles just beyond the shell.
export const CAMERA_END_Z = -2.2

interface CameraTrack {
  readonly start: number
  readonly approach: number
  readonly acceleration: number
  readonly passThrough: number
  readonly settle: number
}

const X_TRACK: CameraTrack = {
  start: CAMERA_BASELINE.position.x,
  approach: 0.09,
  acceleration: -0.13,
  passThrough: 0.07,
  settle: 0.02,
}

const Y_TRACK: CameraTrack = {
  start: CAMERA_BASELINE.position.y,
  approach: -0.04,
  acceleration: 0.08,
  passThrough: -0.07,
  settle: 0,
}

const Z_TRACK: CameraTrack = {
  start: CAMERA_START_Z,
  approach: 3.35,
  acceleration: 1.2,
  passThrough: CAMERA_PORTAL_Z,
  settle: CAMERA_END_Z,
}

const ROLL_TRACK: CameraTrack = {
  start: CAMERA_BASELINE.rotation.z,
  approach: 1.5 * DEG_TO_RAD,
  acceleration: 6 * DEG_TO_RAD,
  passThrough: 12 * DEG_TO_RAD,
  settle: 2 * DEG_TO_RAD,
}

const FOV_TRACK: CameraTrack = {
  start: CAMERA_BASELINE.fov,
  approach: 48,
  acceleration: 56,
  passThrough: 64,
  settle: 52,
}

interface CameraRigProps {
  journeyProgress: JourneyProgressRef
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function sampleTrack(
  localProgress: number,
  track: CameraTrack,
  effect: CameraDiveEffect,
): number {
  const { stillness, approach, acceleration, passThrough, settle } =
    effect.stages

  if (localProgress <= stillness.end) return track.start
  if (localProgress < approach.end) {
    return mix(
      track.start,
      track.approach,
      smootherstep01(segmentProgress(localProgress, approach)),
    )
  }
  if (localProgress < acceleration.end) {
    return mix(
      track.approach,
      track.acceleration,
      smootherstep01(segmentProgress(localProgress, acceleration)),
    )
  }
  if (localProgress < passThrough.end) {
    return mix(
      track.acceleration,
      track.passThrough,
      smootherstep01(segmentProgress(localProgress, passThrough)),
    )
  }
  return mix(
    track.passThrough,
    track.settle,
    smootherstep01(segmentProgress(localProgress, settle)),
  )
}

function restoreBaseline(camera: PerspectiveCamera): void {
  camera.position.set(
    CAMERA_BASELINE.position.x,
    CAMERA_BASELINE.position.y,
    CAMERA_BASELINE.position.z,
  )
  camera.rotation.set(
    CAMERA_BASELINE.rotation.x,
    CAMERA_BASELINE.rotation.y,
    CAMERA_BASELINE.rotation.z,
  )

  if (camera.fov !== CAMERA_BASELINE.fov) {
    camera.fov = CAMERA_BASELINE.fov
    camera.updateProjectionMatrix()
  }
}

export function CameraRig({ journeyProgress }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  const projectedFovRef = useRef<number>(CAMERA_BASELINE.fov)

  useEffect(() => {
    return () => {
      if (camera instanceof PerspectiveCamera) restoreBaseline(camera)
    }
  }, [camera])

  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return

    const effect = cameraEffects.portalDive
    const localProgress = segmentProgress(journeyProgress.current, effect)
    const x = sampleTrack(localProgress, X_TRACK, effect)
    const y = sampleTrack(localProgress, Y_TRACK, effect)
    const z = sampleTrack(localProgress, Z_TRACK, effect)
    const roll = sampleTrack(localProgress, ROLL_TRACK, effect)
    const fov = sampleTrack(localProgress, FOV_TRACK, effect)

    camera.position.set(x, y, z)
    camera.rotation.set(
      CAMERA_BASELINE.rotation.x,
      CAMERA_BASELINE.rotation.y,
      roll,
    )
    camera.fov = fov

    const projectionAtEndpoint = localProgress === 0 || localProgress === 1
    if (
      Math.abs(projectedFovRef.current - fov) >= FOV_UPDATE_EPSILON ||
      (projectionAtEndpoint && projectedFovRef.current !== fov)
    ) {
      camera.updateProjectionMatrix()
      projectedFovRef.current = fov
    }
  }, -50)

  return null
}

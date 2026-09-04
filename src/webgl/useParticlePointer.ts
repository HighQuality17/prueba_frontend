import { useEffect, useRef } from 'react'
import { Vector2 } from 'three'
import { shouldReduceMotion } from './motionPreferences'

export interface ParticlePointerState {
  readonly target: Vector2
  readonly smoothed: Vector2
  activeTarget: number
  active: number
  enabled: boolean
  hasSample: boolean
}

export function useParticlePointer() {
  const pointer = useRef<ParticlePointerState>({
    target: new Vector2(),
    smoothed: new Vector2(),
    activeTarget: 0,
    active: 0,
    enabled: false,
    hasSample: false,
  })

  useEffect(() => {
    const finePointerQuery = window.matchMedia('(pointer: fine)')
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )

    const updateCapability = () => {
      const state = pointer.current
      state.enabled =
        finePointerQuery.matches &&
        !shouldReduceMotion(reducedMotionQuery.matches)

      if (!state.enabled) {
        state.activeTarget = 0
        state.hasSample = false
      }
    }
    const updatePointer = (event: PointerEvent) => {
      const state = pointer.current
      if (!state.enabled || event.pointerType === 'touch') {
        state.activeTarget = 0
        return
      }

      state.target.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
      )
      if (!state.hasSample) {
        state.smoothed.copy(state.target)
        state.hasSample = true
      }
      state.activeTarget = 1
    }
    const deactivate = () => {
      pointer.current.activeTarget = 0
    }
    const deactivatePointer = (event: PointerEvent) => {
      if (event.relatedTarget) return
      deactivate()
    }
    const handleVisibilityChange = () => {
      if (document.hidden) pointer.current.activeTarget = 0
    }

    updateCapability()
    window.addEventListener('pointermove', updatePointer)
    window.addEventListener('pointerenter', updatePointer)
    window.addEventListener('pointerleave', deactivatePointer)
    window.addEventListener('pointerout', deactivatePointer)
    window.addEventListener('blur', deactivate)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    finePointerQuery.addEventListener('change', updateCapability)
    reducedMotionQuery.addEventListener('change', updateCapability)

    return () => {
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('pointerenter', updatePointer)
      window.removeEventListener('pointerleave', deactivatePointer)
      window.removeEventListener('pointerout', deactivatePointer)
      window.removeEventListener('blur', deactivate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      finePointerQuery.removeEventListener('change', updateCapability)
      reducedMotionQuery.removeEventListener('change', updateCapability)
    }
  }, [])

  return pointer
}

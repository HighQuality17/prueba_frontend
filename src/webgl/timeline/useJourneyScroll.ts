import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { shouldReduceMotion } from '../motionPreferences'
import type { JourneyProgressRef } from './journeyProgress'

gsap.registerPlugin(ScrollTrigger)

type JourneyProgressListener = (progress: number) => void

const JOURNEY_END_MARKER_ID = 'journey-end'
const LENIS_WHEEL_MULTIPLIER = 0.5
const LENIS_TOUCH_MULTIPLIER = 1
const LENIS_LERP = 0.18
const NATIVE_SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
])
const journeyProgressListeners = new Set<JourneyProgressListener>()
let currentJourneyProgress = 0
let activeLenis: Lenis | null = null

export function advanceJourneyScroll(timestamp: number) {
  activeLenis?.raf(timestamp)
}

export function publishJourneyProgress(progress: number) {
  currentJourneyProgress = progress
  journeyProgressListeners.forEach((listener) => listener(progress))
}

export function subscribeJourneyProgress(listener: JourneyProgressListener) {
  journeyProgressListeners.add(listener)
  listener(currentJourneyProgress)
  return () => {
    journeyProgressListeners.delete(listener)
  }
}

/**
 * Owns the single global scroll controller:
 * document scroll -> normalized raw journey target.
 * The returned object is stable and mutates without causing React renders;
 * Experience smooths it once before sharing visual progress with WebGL systems.
 */
export function useJourneyScroll(): JourneyProgressRef {
  const rawJourneyProgress = useRef(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (shouldReduceMotion(prefersReducedMotion)) {
      rawJourneyProgress.current = 0
      publishJourneyProgress(0)
      return
    }

    let active = true
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: LENIS_WHEEL_MULTIPLIER,
      touchMultiplier: LENIS_TOUCH_MULTIPLIER,
      lerp: LENIS_LERP,
    })
    activeLenis = lenis

    const cancelSmoothInertia = () => {
      if (lenis.isScrolling !== 'smooth') return
      lenis.stop()
      lenis.start()
    }
    const handleNativeScrollKey = (event: KeyboardEvent) => {
      if (NATIVE_SCROLL_KEYS.has(event.key)) cancelSmoothInertia()
    }
    const handleAnchorClick = (event: MouseEvent) => {
      const anchor = event.composedPath().find(
        (node): node is HTMLAnchorElement =>
          node instanceof HTMLAnchorElement && Boolean(node.hash),
      )
      if (
        anchor &&
        anchor.origin === window.location.origin &&
        anchor.pathname === window.location.pathname
      ) {
        cancelSmoothInertia()
      }
    }

    window.addEventListener('keydown', handleNativeScrollKey, true)
    window.addEventListener('pointerdown', cancelSmoothInertia, true)
    window.addEventListener('click', handleAnchorClick, true)

    const stopScrollTriggerSync = lenis.on('scroll', () => {
      ScrollTrigger.update()
    })
    const trigger = ScrollTrigger.create({
      start: 0,
      end: () => {
        const marker = document.getElementById(JOURNEY_END_MARKER_ID)
        if (!marker) return ScrollTrigger.maxScroll(window)
        return Math.max(marker.offsetTop - window.innerHeight, 1)
      },
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        rawJourneyProgress.current = self.progress
      },
      onRefresh: (self) => {
        rawJourneyProgress.current = self.progress
      },
    })

    // One owned-trigger refresh after webfonts settle their layout impact.
    document.fonts?.ready.then(() => {
      if (active) trigger.refresh()
    })

    return () => {
      active = false
      window.removeEventListener('keydown', handleNativeScrollKey, true)
      window.removeEventListener('pointerdown', cancelSmoothInertia, true)
      window.removeEventListener('click', handleAnchorClick, true)
      stopScrollTriggerSync()
      lenis.destroy()
      if (activeLenis === lenis) activeLenis = null
      trigger.kill()
    }
  }, [])

  return rawJourneyProgress
}

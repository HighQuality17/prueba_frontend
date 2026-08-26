import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface JourneyProgressRef {
  current: number
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
    const ignoreReducedMotion =
      import.meta.env.VITE_IGNORE_REDUCED_MOTION === 'true'

    if (prefersReducedMotion && !ignoreReducedMotion) {
      rawJourneyProgress.current = 0
      return
    }

    let active = true
    const trigger = ScrollTrigger.create({
      start: 0,
      end: () => ScrollTrigger.maxScroll(window),
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
      trigger.kill()
    }
  }, [])

  return rawJourneyProgress
}

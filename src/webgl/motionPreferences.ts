export function shouldReduceMotion(prefersReducedMotion: boolean): boolean {
  return (
    prefersReducedMotion &&
    import.meta.env.VITE_IGNORE_REDUCED_MOTION !== 'true'
  )
}

import type { WebGLRenderer } from 'three'

export type PreparationStatus = 'pending' | 'running' | 'ready' | 'error'
export type PreparationKey = 'tunnel' | 'postprocessing'

export interface PreparationStep {
  status: PreparationStatus
  attempt: number
  durationMs: number | null
  programsBefore: number | null
  programsAfter: number | null
  error: string | null
  markName: string | null
  startedAt: number | null
}

export interface TunnelPreparationState {
  tunnel: PreparationStep
  postprocessing: PreparationStep
}

function createStep(): PreparationStep {
  return {
    status: 'pending',
    attempt: 0,
    durationMs: null,
    programsBefore: null,
    programsAfter: null,
    error: null,
    markName: null,
    startedAt: null,
  }
}

export function createTunnelPreparationState(): TunnelPreparationState {
  return {
    tunnel: createStep(),
    postprocessing: createStep(),
  }
}

export function isTunnelPerfDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debugTunnelPerf') === '1'
}

export function rendererProgramCount(gl: WebGLRenderer): number | null {
  return gl.info.programs?.length ?? null
}

export function logTunnelPerf(
  enabled: boolean,
  event: string,
  details: Record<string, unknown>,
): void {
  if (!enabled) return
  console.info(`[TunnelPerf] ${event}`, details)
}

export function beginPreparation(
  state: TunnelPreparationState,
  key: PreparationKey,
  gl: WebGLRenderer,
  debugEnabled: boolean,
): void {
  const step = state[key]
  step.attempt += 1
  step.status = 'running'
  step.error = null
  step.durationMs = null
  step.programsBefore = rendererProgramCount(gl)
  step.markName = `tunnel-perf:${key}:${step.attempt}`
  step.startedAt = performance.now()
  if (debugEnabled) performance.mark(`${step.markName}:start`)
  logTunnelPerf(debugEnabled, `${key}:prewarm-start`, {
    attempt: step.attempt,
    programsBefore: step.programsBefore,
  })
}

export function completePreparation(
  state: TunnelPreparationState,
  key: PreparationKey,
  gl: WebGLRenderer,
  debugEnabled: boolean,
): void {
  const step = state[key]
  if (!step.markName) return

  const elapsedDuration = performance.now() - (step.startedAt ?? performance.now())
  if (debugEnabled) {
    performance.mark(`${step.markName}:end`)
    performance.measure(step.markName, {
      start: `${step.markName}:start`,
      end: `${step.markName}:end`,
    })
  }
  step.status = 'ready'
  step.durationMs = elapsedDuration
  step.programsAfter = rendererProgramCount(gl)
  logTunnelPerf(debugEnabled, `${key}:prewarm-end`, {
    attempt: step.attempt,
    elapsedDurationMs: Number(elapsedDuration.toFixed(2)),
    programsBefore: step.programsBefore,
    programsAfter: step.programsAfter,
  })
}

export function failPreparation(
  state: TunnelPreparationState,
  key: PreparationKey,
  error: unknown,
  debugEnabled: boolean,
): void {
  if (error instanceof DOMException && error.name === 'AbortError') return

  const step = state[key]
  step.status = 'error'
  step.error = error instanceof Error ? error.message : String(error)
  logTunnelPerf(debugEnabled, `${key}:prewarm-error`, {
    attempt: step.attempt,
    error: step.error,
  })
  console.error(`[TunnelPrewarm] ${key} preparation failed`, error)
}

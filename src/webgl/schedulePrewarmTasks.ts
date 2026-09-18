type IdleTask = () => void | Promise<void>

interface ScheduledTask {
  readonly batch: ScheduledBatch
  readonly run: IdleTask
}

interface ScheduledBatch {
  cancelled: boolean
  remaining: number
  resolve: () => void
  reject: (reason: unknown) => void
}

export interface ScheduledPrewarm {
  readonly promise: Promise<void>
  cancel: () => void
}

let queue: ScheduledTask[] = []
let scheduled = false
let running = false

function scheduleNext(): void {
  if (scheduled || running) return
  while (queue[0]?.batch.cancelled) queue.shift()
  if (queue.length === 0) return

  scheduled = true
  const runNext = () => {
    scheduled = false
    const next = queue.shift()
    if (!next || next.batch.cancelled) {
      scheduleNext()
      return
    }

    running = true
    Promise.resolve(next.run())
      .then(() => {
        if (next.batch.cancelled) return
        next.batch.remaining -= 1
        if (next.batch.remaining === 0) next.batch.resolve()
      })
      .catch((error: unknown) => {
        next.batch.cancelled = true
        queue = queue.filter((task) => task.batch !== next.batch)
        next.batch.reject(error)
      })
      .finally(() => {
        running = false
        scheduleNext()
      })
  }

  // Yield between batches, but guarantee startup work begins without waiting
  // for requestIdleCallback, which may arrive after a fast scroll to the tunnel.
  globalThis.setTimeout(runNext, 0)
}

export function schedulePrewarmTasks(
  tasks: readonly IdleTask[],
): ScheduledPrewarm {
  let resolvePromise: () => void = () => undefined
  let rejectPromise: (reason: unknown) => void = () => undefined
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  const batch: ScheduledBatch = {
    cancelled: false,
    remaining: tasks.length,
    resolve: resolvePromise,
    reject: rejectPromise,
  }
  queue.push(...tasks.map((run) => ({ batch, run })))

  if (tasks.length === 0) resolvePromise()
  else scheduleNext()

  return {
    promise,
    cancel: () => {
      if (batch.cancelled || batch.remaining === 0) return
      batch.cancelled = true
      queue = queue.filter((task) => task.batch !== batch)
      rejectPromise(new DOMException('Prewarm cancelled', 'AbortError'))
    },
  }
}

export function getPendingPrewarmTaskCount(): number {
  return queue.filter((task) => !task.batch.cancelled).length + (running ? 1 : 0)
}

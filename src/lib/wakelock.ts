import NoSleep from 'nosleep.js'

let noSleep: NoSleep | null = null
let wanted = false
const listeners = new Set<(on: boolean) => void>()

function notify() {
  const on = isAwake()
  listeners.forEach((l) => l(on))
}

export function isAwake() {
  return !!noSleep?.isEnabled
}

/** Call from a user gesture when possible. */
export async function keepAwake() {
  wanted = true
  try {
    if (!noSleep) noSleep = new NoSleep()
    if (!noSleep.isEnabled) await noSleep.enable()
  } catch {
    /* needs a gesture: UI will show a button */
  }
  notify()
}

export function releaseAwake() {
  wanted = false
  try {
    noSleep?.disable()
  } catch {
    /* ignore */
  }
  notify()
}

export function onAwakeChange(cb: (on: boolean) => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted) {
    // native wake locks are dropped when the page is hidden: re-acquire
    try {
      noSleep?.disable()
    } catch {
      /* ignore */
    }
    void keepAwake()
  } else notify()
})


import { useSyncExternalStore } from 'react'

export interface Settings {
  name: string
  vma: number | null // km/h
  weight: number // kg
  voice: boolean
  announceKm: boolean
  ghostVoice: boolean
  autoPause: boolean
  weeklyGoalKm: number
  radarRotate: boolean
  demoGps: boolean
  beeps: boolean
}

const KEY = 'rf-settings'
const defaults: Settings = {
  name: 'Forest',
  vma: null,
  weight: 70,
  voice: true,
  announceKm: true,
  ghostVoice: true,
  autoPause: false,
  weeklyGoalKm: 15,
  radarRotate: true,
  demoGps: false,
  beeps: true,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...defaults }
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}
export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

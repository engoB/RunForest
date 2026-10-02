import { useSyncExternalStore } from 'react'
import type { Workout } from './types'
import { getRun } from './storage'
import type { GhostRef } from './tracker'

export type Tab = 'run' | 'intervals' | 'history' | 'profile'
export type Overlay =
  | { type: 'run-detail'; id: string }
  | { type: 'workout'; workout: Workout }
  | { type: 'builder'; workout?: Workout }
  | { type: 'guide' }
  | { type: 'help' }

interface NavState {
  tab: Tab
  stack: Overlay[]
  pendingWorkout: Workout | null
  pendingGhostId: string | null
}

let nav: NavState = { tab: 'run', stack: [], pendingWorkout: null, pendingGhostId: null }
const listeners = new Set<() => void>()
const set = (p: Partial<NavState>) => {
  nav = { ...nav, ...p }
  listeners.forEach((l) => l())
}

export function useNav() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => nav,
  )
}
export const setTab = (tab: Tab) => set({ tab, stack: [] })
export const push = (o: Overlay) => set({ stack: [...nav.stack, o] })
export const pop = () => set({ stack: nav.stack.slice(0, -1) })
export const clearStack = () => set({ stack: [] })
export const setPendingWorkout = (w: Workout | null) => set({ pendingWorkout: w })
export const setPendingGhost = (id: string | null) => set({ pendingGhostId: id })

export async function loadGhost(id: string): Promise<GhostRef | null> {
  const r = await getRun(id)
  if (!r || r.points.length < 2) return null
  return { id: r.id, name: r.name, points: r.points, totalMs: r.activeMs, distance: r.distance }
}

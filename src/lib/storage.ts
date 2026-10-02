import { get, set, del } from 'idb-keyval'
import { useEffect, useSyncExternalStore } from 'react'
import type { Run, RunSummary, TrackPoint } from './types'

const INDEX = 'runs:index'
let index: RunSummary[] = []
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export async function loadIndex(): Promise<RunSummary[]> {
  if (loaded) return index
  index = ((await get(INDEX)) as RunSummary[] | undefined) ?? []
  index.sort((a, b) => b.startedAt - a.startedAt)
  loaded = true
  emit()
  return index
}

export function useRuns(): RunSummary[] {
  useEffect(() => {
    void loadIndex()
  }, [])
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => index,
  )
}

export function summaryOf(run: Run): RunSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { points, splits, stepLog, ...s } = run
  void points
  void splits
  void stepLog
  return s
}

export async function saveRun(run: Run) {
  await loadIndex()
  await set(`run:${run.id}`, run)
  index = [summaryOf(run), ...index.filter((r) => r.id !== run.id)].sort((a, b) => b.startedAt - a.startedAt)
  await set(INDEX, index)
  emit()
}

export async function getRun(id: string): Promise<Run | undefined> {
  return (await get(`run:${id}`)) as Run | undefined
}

export async function deleteRun(id: string) {
  await loadIndex()
  await del(`run:${id}`)
  index = index.filter((r) => r.id !== id)
  await set(INDEX, index)
  emit()
}

export async function renameRun(id: string, name: string) {
  const run = await getRun(id)
  if (!run) return
  run.name = name
  await saveRun(run)
}

export async function exportAll(): Promise<string> {
  await loadIndex()
  const runs: Run[] = []
  for (const s of index) {
    const r = await getRun(s.id)
    if (r) runs.push(r)
  }
  return JSON.stringify({ app: 'RunForest', version: 1, exportedAt: Date.now(), settings: localStorage.getItem('rf-settings'), workouts: localStorage.getItem('rf-workouts'), runs })
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json)
  if (data.app !== 'RunForest' || !Array.isArray(data.runs)) throw new Error('Fichier invalide')
  if (data.settings) localStorage.setItem('rf-settings', data.settings)
  if (data.workouts) localStorage.setItem('rf-workouts', data.workouts)
  for (const r of data.runs as Run[]) await saveRun(r)
  return data.runs.length
}

/** Simplify a track for ghost/minimap usage when needed */
export function decimate(points: TrackPoint[], every = 1): TrackPoint[] {
  if (every <= 1) return points
  return points.filter((_, i) => i % every === 0 || i === points.length - 1)
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* ignore */
  }
}

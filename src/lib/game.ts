import type { RunSummary, TrackPoint } from './types'

/* ---------- XP & levels ---------- */
export const RANKS = [
  'Piéton',
  'Promeneur',
  'Joggeur du dimanche',
  'Coureur de quartier',
  'Runner de rue',
  'Chasseur de chrono',
  'Fusée urbaine',
  'Machine',
  'Légende locale',
  'Forest en personne',
]

export function levelFromXp(xp: number) {
  // level n requires 100 * n^1.6 cumulative
  let level = 1
  const need = (l: number) => Math.round(120 * Math.pow(l - 1, 1.55))
  while (xp >= need(level + 1)) level++
  const cur = need(level)
  const next = need(level + 1)
  return {
    level,
    rank: RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))],
    progress: (xp - cur) / (next - cur),
    toNext: next - xp,
  }
}

export function computeXp(r: { distance: number; activeMs: number; kind: string; ghostDelta?: number; workoutCompleted?: boolean }) {
  let xp = Math.round((r.distance / 1000) * 20)
  xp += Math.round(r.activeMs / 60000) // 1 xp / min
  if (r.kind === 'intervals' && r.workoutCompleted) xp += 60
  if (r.kind === 'vma-test' && r.workoutCompleted) xp += 80
  if (r.ghostDelta !== undefined && r.ghostDelta > 0) xp += 50
  return Math.max(5, xp)
}

export function calories(distanceM: number, weightKg: number) {
  return Math.round((distanceM / 1000) * weightKg * 1.036)
}

/* ---------- best efforts ---------- */
export function bestEffort(points: TrackPoint[], target: number): number | undefined {
  if (!points.length || points[points.length - 1].d < target) return undefined
  let best = Infinity
  let j = 0
  for (let i = 0; i < points.length; i++) {
    while (j < points.length && points[j].d - points[i].d < target) j++
    if (j >= points.length) break
    const pj = points[j]
    const pj0 = points[j - 1]
    // interpolate exact crossing
    const need = points[i].d + target
    const f = pj.d === pj0.d ? 1 : (need - pj0.d) / (pj.d - pj0.d)
    const tCross = pj0.a + f * (pj.a - pj0.a)
    const dt = tCross - points[i].a
    if (dt > 0 && dt < best) best = dt
  }
  return isFinite(best) ? best : undefined
}

/* ---------- weekly + streak ---------- */
export function startOfWeek(ts = Date.now()) {
  const d = new Date(ts)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

export function weekKm(runs: RunSummary[]) {
  const s = startOfWeek()
  return runs.filter((r) => r.startedAt >= s).reduce((a, r) => a + r.distance, 0) / 1000
}

export function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function streakDays(runs: RunSummary[]) {
  const days = new Set(runs.map((r) => dayKey(r.startedAt)))
  let streak = 0
  const d = new Date()
  // today may not have a run yet: start from yesterday if needed
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d.getTime()))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/* ---------- achievements ---------- */
export interface Achievement {
  id: string
  icon: string
  name: string
  desc: string
  test: (runs: RunSummary[], tot: Totals) => boolean
}
export interface Totals {
  km: number
  runs: number
  ms: number
  xp: number
  maxRunKm: number
  bestPace: number
}

export function totals(runs: RunSummary[]): Totals {
  let km = 0,
    ms = 0,
    xp = 0,
    maxRunKm = 0,
    bestPace = Infinity
  for (const r of runs) {
    km += r.distance / 1000
    ms += r.activeMs
    xp += r.xp
    maxRunKm = Math.max(maxRunKm, r.distance / 1000)
    if (r.best1k) bestPace = Math.min(bestPace, r.best1k / 1000)
  }
  return { km, runs: runs.length, ms, xp, maxRunKm, bestPace }
}

const hour = (ts: number) => new Date(ts).getHours()

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '👟', name: 'Premier pas', desc: 'Terminer ta première course', test: (r) => r.length >= 1 },
  { id: '5k', icon: '🥉', name: 'Cinq bornes', desc: 'Courir 5 km d’un coup', test: (_, t) => t.maxRunKm >= 5 },
  { id: '10k', icon: '🥈', name: 'Dix bornes', desc: 'Courir 10 km d’un coup', test: (_, t) => t.maxRunKm >= 10 },
  { id: 'semi', icon: '🥇', name: 'Semi-dieu', desc: 'Courir 21,1 km d’un coup', test: (_, t) => t.maxRunKm >= 21.1 },
  { id: 'marathon-cumul', icon: '🏛️', name: 'Marathon en kit', desc: '42,2 km cumulés', test: (_, t) => t.km >= 42.2 },
  { id: '100k', icon: '💯', name: 'Centurion', desc: '100 km cumulés', test: (_, t) => t.km >= 100 },
  { id: '500k', icon: '🚀', name: 'Orbite', desc: '500 km cumulés', test: (_, t) => t.km >= 500 },
  { id: 'ghost', icon: '👻', name: 'Chasseur de fantômes', desc: 'Battre ton fantôme', test: (r) => r.some((x) => (x.ghostDelta ?? 0) > 0) },
  { id: 'intervals', icon: '⏱️', name: 'Fractionneur', desc: 'Terminer une séance de fractionné', test: (r) => r.some((x) => x.kind === 'intervals') },
  { id: 'vma', icon: '🧪', name: 'Labo', desc: 'Faire un test VMA', test: (r) => r.some((x) => x.vmaResult) },
  { id: 'early', icon: '🌅', name: 'Lève-tôt', desc: 'Courir avant 7 h', test: (r) => r.some((x) => hour(x.startedAt) < 7) },
  { id: 'night', icon: '🌙', name: 'Oiseau de nuit', desc: 'Courir après 21 h', test: (r) => r.some((x) => hour(x.startedAt) >= 21) },
  { id: 'sub5', icon: '⚡', name: 'Sous les 5', desc: '1 km en moins de 5 min', test: (_, t) => t.bestPace < 300 },
  { id: 'sub4', icon: '🔥', name: 'Sous les 4', desc: '1 km en moins de 4 min', test: (_, t) => t.bestPace < 240 },
  { id: 'climber', icon: '⛰️', name: 'Grimpeur', desc: '100 m de D+ sur une sortie', test: (r) => r.some((x) => x.elevGain >= 100) },
  { id: 'streak3', icon: '📅', name: 'Régulier', desc: '3 jours de suite', test: (r) => streakDays(r) >= 3 || maxStreak(r) >= 3 },
  { id: 'ten-runs', icon: '🔟', name: 'Habitué', desc: '10 sorties enregistrées', test: (r) => r.length >= 10 },
  { id: 'hour', icon: '⌛', name: 'L’heure de vérité', desc: 'Courir 1 h d’affilée', test: (r) => r.some((x) => x.activeMs >= 3_600_000) },
]

function maxStreak(runs: RunSummary[]) {
  const days = [...new Set(runs.map((r) => { const d = new Date(r.startedAt); d.setHours(0, 0, 0, 0); return d.getTime() }))].sort()
  let best = 0,
    cur = 0,
    prev = 0
  for (const d of days) {
    cur = prev && Math.round((d - prev) / 86_400_000) === 1 ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

export function unlocked(runs: RunSummary[]) {
  const t = totals(runs)
  return new Set(ACHIEVEMENTS.filter((a) => a.test(runs, t)).map((a) => a.id))
}

/** "Wanted" stars from intensity (speed vs VMA) */
export function intensityStars(speedMs: number, vma: number | null): number {
  if (speedMs < 0.8) return 0
  const kmh = speedMs * 3.6
  const ref = vma || 14
  const pct = kmh / ref
  if (pct >= 1) return 5
  if (pct >= 0.9) return 4
  if (pct >= 0.8) return 3
  if (pct >= 0.65) return 2
  return 1
}

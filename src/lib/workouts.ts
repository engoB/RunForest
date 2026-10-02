import { useSyncExternalStore } from 'react'
import type { Step, Workout } from './types'
import { fmtPace, kmhToPace } from './geo'

const min = (m: number) => Math.round(m * 60_000)
const sec = (s: number) => s * 1000

export const warm = (m = 15): Step => ({ type: 'warmup', label: 'Échauffement', kind: 'time', value: min(m), pct: 65, hint: 'Footing très facile, tu dois pouvoir parler.' })
export const cool = (m = 10): Step => ({ type: 'cooldown', label: 'Retour au calme', kind: 'time', value: min(m), pct: 60, hint: 'Trottine tranquille, laisse redescendre le cœur.' })
const work = (kind: 'time' | 'distance', value: number, pct: number, label = 'Effort'): Step => ({ type: 'work', label, kind, value, pct })
const rest = (kind: 'time' | 'distance', value: number, label = 'Récup'): Step => ({ type: 'rest', label, kind, value, pct: 50, hint: 'Trottine ou marche, respire.' })

export interface BuilderParams {
  name: string
  warmupMin: number
  sets: number
  reps: number
  workKind: 'time' | 'distance'
  workValue: number // seconds or meters
  workPct: number
  restKind: 'time' | 'distance'
  restValue: number // seconds or meters
  setRestMin: number
  cooldownMin: number
}

export function buildSteps(p: BuilderParams): Step[] {
  const steps: Step[] = []
  if (p.warmupMin > 0) steps.push(warm(p.warmupMin))
  for (let s = 0; s < p.sets; s++) {
    for (let r = 0; r < p.reps; r++) {
      const wv = p.workKind === 'time' ? sec(p.workValue) : p.workValue
      steps.push(work(p.workKind, wv, p.workPct, `Effort ${r + 1}/${p.reps}${p.sets > 1 ? ` · série ${s + 1}` : ''}`))
      const last = r === p.reps - 1
      if (!last && p.restValue > 0) steps.push(rest(p.restKind, p.restKind === 'time' ? sec(p.restValue) : p.restValue))
    }
    if (s < p.sets - 1 && p.setRestMin > 0) steps.push({ ...rest('time', min(p.setRestMin), 'Récup entre séries'), hint: 'Marche puis trottine. Bois un coup si besoin.' })
  }
  if (p.cooldownMin > 0) steps.push(cool(p.cooldownMin))
  return steps
}

function seq(...parts: (Step | Step[])[]): Step[] {
  return parts.flat()
}
function reps(n: number, w: () => Step, r: () => Step | null): Step[] {
  const out: Step[] = []
  for (let i = 0; i < n; i++) {
    const ws = w()
    out.push({ ...ws, label: `${ws.label} ${i + 1}/${n}` })
    const rs = r()
    if (i < n - 1 && rs) out.push(rs)
  }
  return out
}

export const PRESETS: Workout[] = [
  {
    id: 'vma-test',
    name: 'Test VMA (demi-Cooper)',
    emoji: '🧪',
    level: 'Test',
    goal: 'Mesurer ta VMA',
    description: "15 min d'échauffement puis 6 minutes à fond, à allure la plus régulière possible. La distance parcourue / 100 = ta VMA en km/h. L'appli la calcule pour toi.",
    steps: seq(warm(15), { type: 'test', label: 'TEST 6 MIN À FOND', kind: 'time', value: min(6), pct: 100, hint: 'Pars vite mais pas sprint : allure régulière, vide le réservoir sur la dernière minute.' }, cool(10)),
  },
  {
    id: '30-30-debutant',
    name: '30/30 découverte',
    emoji: '🌱',
    level: 'Débutant',
    goal: 'VMA courte',
    description: '8 × (30 s vite / 30 s trot). La séance idéale pour découvrir le fractionné.',
    steps: seq(warm(15), reps(8, () => work('time', sec(30), 100, 'Vite'), () => rest('time', sec(30))), cool(10)),
  },
  {
    id: '30-30-x2',
    name: '2 × 10 × 30/30',
    emoji: '⚡',
    level: 'Intermédiaire',
    goal: 'VMA courte',
    description: 'Le grand classique : 2 séries de 10 × (30 s vite / 30 s trot), 3 min de récup entre les séries.',
    steps: buildSteps({ name: '', warmupMin: 20, sets: 2, reps: 10, workKind: 'time', workValue: 30, workPct: 100, restKind: 'time', restValue: 30, setRestMin: 3, cooldownMin: 10 }),
  },
  {
    id: '10x400',
    name: '10 × 400 m',
    emoji: '🏟️',
    level: 'Intermédiaire',
    goal: 'VMA',
    description: '10 × 400 m à 100 % VMA, récup 1 min 15 trottinée. Parfait sur piste ou portion plate.',
    steps: seq(warm(20), reps(10, () => work('distance', 400, 100, '400 m'), () => rest('time', sec(75))), cool(10)),
  },
  {
    id: '6x1000',
    name: '6 × 1000 m',
    emoji: '🔥',
    level: 'Confirmé',
    goal: 'VMA longue',
    description: '6 × 1 km à 90 % VMA, récup 2 min. Travaille ta capacité à tenir vite longtemps (10 km, semi).',
    steps: seq(warm(20), reps(6, () => work('distance', 1000, 90, '1000 m'), () => rest('time', sec(120))), cool(10)),
  },
  {
    id: '5x3min',
    name: '5 × 3 min',
    emoji: '🎯',
    level: 'Intermédiaire',
    goal: 'VMA longue',
    description: '5 × 3 min à 92 % VMA, récup 1 min 30 trottinée (moitié du temps d’effort).',
    steps: seq(warm(20), reps(5, () => work('time', min(3), 92, '3 min'), () => rest('time', sec(90))), cool(10)),
  },
  {
    id: 'pyramide',
    name: 'Pyramide 200 → 800 → 200',
    emoji: '🔺',
    level: 'Confirmé',
    goal: 'VMA',
    description: '200-400-600-800-600-400-200 m, récup = 1 min 30 trottinée. Plus c’est court, plus c’est vite.',
    steps: seq(
      warm(20),
      [200, 400, 600, 800, 600, 400, 200].flatMap((d, i, arr) => {
        const pct = d <= 200 ? 105 : d <= 400 ? 100 : d <= 600 ? 95 : 92
        const s: Step[] = [work('distance', d, pct, `${d} m`)]
        if (i < arr.length - 1) s.push(rest('time', sec(90)))
        return s
      }),
      cool(10),
    ),
  },
  {
    id: 'fartlek',
    name: 'Fartlek 1-2-3-2-1',
    emoji: '🌲',
    level: 'Débutant',
    goal: 'Variations d’allure',
    description: 'Accélérations de 1, 2, 3, 2 puis 1 min à 85-95 % VMA, récup 1 min entre chaque. Idéal en forêt, sans pression.',
    steps: seq(
      warm(15),
      [1, 2, 3, 2, 1].flatMap((m, i, arr) => {
        const s: Step[] = [work('time', min(m), m === 3 ? 85 : m === 2 ? 90 : 95, `${m} min`)]
        if (i < arr.length - 1) s.push(rest('time', min(1)))
        return s
      }),
      cool(10),
    ),
  },
  {
    id: 'seuil',
    name: 'Seuil 3 × 8 min',
    emoji: '🧱',
    level: 'Confirmé',
    goal: 'Seuil / endurance rapide',
    description: '3 × 8 min à 85 % VMA (allure semi/10 km), récup 2 min. Tu dois être « confortablement inconfortable ».',
    steps: seq(warm(15), reps(3, () => work('time', min(8), 85, '8 min seuil'), () => rest('time', min(2))), cool(10)),
  },
]

/* ---------- custom workouts (localStorage) ---------- */
const KEY = 'rf-workouts'
let custom: Workout[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
})()
const listeners = new Set<() => void>()

export function useCustomWorkouts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => custom,
  )
}
export function saveCustomWorkout(w: Workout) {
  custom = [w, ...custom.filter((c) => c.id !== w.id)]
  localStorage.setItem(KEY, JSON.stringify(custom))
  listeners.forEach((l) => l())
}
export function deleteCustomWorkout(id: string) {
  custom = custom.filter((c) => c.id !== id)
  localStorage.setItem(KEY, JSON.stringify(custom))
  listeners.forEach((l) => l())
}
export function findWorkout(id: string): Workout | undefined {
  return PRESETS.find((p) => p.id === id) || custom.find((c) => c.id === id)
}

/* ---------- helpers ---------- */
export function workoutTotals(w: Workout) {
  let ms = 0
  let m = 0
  let work = 0
  for (const s of w.steps) {
    if (s.type === 'work' || s.type === 'test') work++
    if (s.kind === 'time') ms += s.value
    else m += s.value
  }
  return { ms, m, work }
}

export function targetPace(pct: number | undefined, vma: number | null): number | null {
  if (!pct || !vma) return null
  return kmhToPace((vma * pct) / 100)
}

export function stepTarget(step: Step, vma: number | null): string {
  if (step.type === 'rest') return 'trot libre'
  const p = targetPace(step.pct, vma)
  if (!p) return step.pct ? `${step.pct}% VMA` : ''
  return `${fmtPace(p)}/km`
}

export function stepValueLabel(step: Step): string {
  if (step.kind === 'distance') return step.value >= 1000 ? `${step.value / 1000} km` : `${step.value} m`
  const s = Math.round(step.value / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r}` : `${m} min`
}

export const STEP_COLORS: Record<string, string> = {
  warmup: '#38bdf8',
  work: '#ff3b5c',
  test: '#ffb020',
  rest: '#7cfc6b',
  cooldown: '#a78bfa',
}

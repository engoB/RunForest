export interface TrackPoint {
  lat: number
  lng: number
  t: number // epoch ms
  alt: number | null
  acc: number
  d: number // cumulative distance (m)
  a: number // cumulative active time (ms)
  g?: 1 // reached after a signal gap (straight line bridged)
  b?: 1 // new segment after a manual pause (not connected)
}

export interface Split {
  km: number
  ms: number // duration of this km
  at: number // active ms when reached
}

export type StepType = 'warmup' | 'work' | 'rest' | 'cooldown' | 'test'

export interface Step {
  type: StepType
  label: string
  kind: 'time' | 'distance'
  value: number // ms for time, meters for distance
  pct?: number // target % of VMA
  hint?: string
}

export interface Workout {
  id: string
  name: string
  emoji: string
  level: 'Débutant' | 'Intermédiaire' | 'Confirmé' | 'Test'
  goal: string
  description: string
  steps: Step[]
  custom?: boolean
}

export interface StepLog {
  index: number
  type: StepType
  label: string
  distance: number
  ms: number
  pct?: number
}

export interface RunSummary {
  id: string
  name: string
  kind: 'free' | 'intervals' | 'vma-test' | 'imported'
  startedAt: number
  endedAt: number
  distance: number
  activeMs: number
  elapsedMs: number
  maxSpeed: number
  elevGain: number
  calories: number
  xp: number
  gaps: number
  workoutName?: string
  ghostName?: string
  ghostDelta?: number // seconds ahead (+) / behind (-) at finish
  vmaResult?: number
  best1k?: number
  best5k?: number
  best10k?: number
}

export interface Run extends RunSummary {
  points: TrackPoint[]
  splits: Split[]
  stepLog?: StepLog[]
}

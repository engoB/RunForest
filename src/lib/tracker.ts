import { useSyncExternalStore } from 'react'
import { bearing, haversine, spokenDistance, spokenDuration, spokenPace, kmhToPace, fmtPace, type LatLng } from './geo'
import { DemoGps, RealGps, DEFAULT_CENTER, type Fix, type GeoSource } from './gps'
import { getSettings } from './settings'
import { speak, beep, startBeep, fanfare } from './voice'
import { ghostDelta } from './ghost'
import type { Run, Split, StepLog, TrackPoint, Workout } from './types'
import { bestEffort, calories, computeXp } from './game'
import { saveRun } from './storage'
import { keepAwake, releaseAwake } from './wakelock'
import { stepValueLabel } from './workouts'

export type Status = 'idle' | 'running' | 'paused'
export type GpsQuality = 'off' | 'searching' | 'poor' | 'ok' | 'good'

export interface Banner {
  id: number
  title: string
  sub?: string
  color: string
}

export interface GhostRef {
  id: string
  name: string
  points: TrackPoint[]
  totalMs: number
  distance: number
}

export interface LiveState {
  status: Status
  startedAt: number
  points: TrackPoint[]
  distance: number
  activeBase: number
  segStart: number
  autoPaused: boolean
  maxSpeed: number
  elevGain: number
  speed: number
  heading: number | null
  pos: { lat: number; lng: number; acc: number; t: number } | null
  gps: GpsQuality
  gpsError: string | null
  splits: Split[]
  gaps: number
  ghost: GhostRef | null
  ghostAhead: boolean | null
  workout: Workout | null
  stepIndex: number
  stepStartA: number
  stepStartD: number
  stepLog: StepLog[]
  workoutDone: boolean
  banner: Banner | null
  notice: string | null
  tick: number
  vmaResult?: number
}

const ACTIVE_KEY = 'rf-active'

const blank = (): LiveState => ({
  status: 'idle',
  startedAt: 0,
  points: [],
  distance: 0,
  activeBase: 0,
  segStart: 0,
  autoPaused: false,
  maxSpeed: 0,
  elevGain: 0,
  speed: 0,
  heading: null,
  pos: null,
  gps: 'off',
  gpsError: null,
  splits: [],
  gaps: 0,
  ghost: null,
  ghostAhead: null,
  workout: null,
  stepIndex: 0,
  stepStartA: 0,
  stepStartD: 0,
  stepLog: [],
  workoutDone: false,
  banner: null,
  notice: null,
  tick: 0,
})

let state: LiveState = blank()
const listeners = new Set<() => void>()
let source: GeoSource | null = null
let ticker: number | null = null
let lastSave = 0
let lastAccepted: TrackPoint | null = null
let breakNext = false
let rejectStreak = 0
let altRef: number | null = null
let slowSince: number | null = null
let lastBeepSec = -1
let announced100 = false
let bannerSeq = 0
let lastFixAt = 0

function emit(save = false) {
  state = { ...state, tick: state.tick + 1 }
  listeners.forEach((l) => l())
  if (save) persist()
}

export function useLive(): LiveState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
export const getLive = () => state

export function activeMs(s: LiveState = state, now = Date.now()): number {
  return s.activeBase + (s.status === 'running' && !s.autoPaused ? now - s.segStart : 0)
}

function showBanner(title: string, sub?: string, color = '#7cfc6b') {
  state.banner = { id: ++bannerSeq, title, sub, color }
  const id = bannerSeq
  setTimeout(() => {
    if (state.banner?.id === id) {
      state.banner = null
      emit()
    }
  }, 3800)
}
function notice(text: string) {
  state.notice = text
  const n = text
  setTimeout(() => {
    if (state.notice === n) {
      state.notice = null
      emit()
    }
  }, 6000)
}

/* ---------------- persistence ---------------- */
function persist(force = false) {
  if (state.status === 'idle') return
  const now = Date.now()
  if (!force && now - lastSave < 3000) return
  lastSave = now
  try {
    const { banner, notice: _n, tick, ...rest } = state
    void banner
    void _n
    void tick
    const ghost = rest.ghost ? { id: rest.ghost.id } : null
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...rest, ghost, savedAt: now }))
  } catch {
    /* quota: ignore */
  }
}

export function hasActiveSession() {
  return !!localStorage.getItem(ACTIVE_KEY)
}

/** Restore an unfinished run after the app was closed / killed. */
export async function restoreSession(loadGhost: (id: string) => Promise<GhostRef | null>) {
  const raw = localStorage.getItem(ACTIVE_KEY)
  if (!raw) return false
  try {
    const saved = JSON.parse(raw)
    const ghostId = saved.ghost?.id as string | undefined
    state = { ...blank(), ...saved, ghost: null, banner: null, notice: null }
    if (ghostId) state.ghost = await loadGhost(ghostId)
    lastAccepted = state.points[state.points.length - 1] ?? null
    altRef = lastAccepted?.alt ?? null
    const away = Date.now() - (saved.savedAt || Date.now())
    if (state.status === 'running' && away < 15000) notice('Course restaurée, on continue !')
    else if (state.status === 'running') {
      notice(`Course restaurée après ${spokenDuration(away)} hors appli. Le chrono a continué, le tracé sera recollé en ligne droite.`)
    }
    startSource()
    startTicker()
    emit()
    return true
  } catch {
    localStorage.removeItem(ACTIVE_KEY)
    return false
  }
}

/* ---------------- GPS ---------------- */
function desiredDemoSpeed(): number {
  const vma = getSettings().vma || 13
  if (state.status !== 'running') return 0
  const step = state.workout && !state.workoutDone ? state.workout.steps[state.stepIndex] : null
  const pct = step?.pct ?? 72
  return (vma * pct) / 100 / 3.6
}

function startSource() {
  source?.stop()
  if (getSettings().demoGps) {
    let c: LatLng = state.pos ? [state.pos.lat, state.pos.lng] : DEFAULT_CENTER
    try {
      const saved = sessionStorage.getItem('rf-demo-center')
      if (saved) c = JSON.parse(saved)
      else sessionStorage.setItem('rf-demo-center', JSON.stringify(c))
    } catch {
      /* ignore */
    }
    source = new DemoGps(c, desiredDemoSpeed)
  } else source = new RealGps()
  if (state.gps === 'off') state.gps = 'searching'
  source.start(onFix, (msg) => {
    state.gpsError = msg
    state.gps = 'off'
    emit()
  })
}

function quality(acc: number): GpsQuality {
  if (acc <= 12) return 'good'
  if (acc <= 25) return 'ok'
  return 'poor'
}

function onFix(f: Fix) {
  lastFixAt = Date.now()
  state.gpsError = null
  state.gps = quality(f.acc)
  const prevPos = state.pos
  state.pos = { lat: f.lat, lng: f.lng, acc: f.acc, t: f.t }
  if (f.heading !== null && !isNaN(f.heading) && (f.speed ?? 0) > 0.8) state.heading = f.heading
  else if (prevPos && haversine([prevPos.lat, prevPos.lng], [f.lat, f.lng]) > 3) state.heading = bearing([prevPos.lat, prevPos.lng], [f.lat, f.lng])

  if (state.status !== 'running') {
    emit()
    return
  }
  if (f.acc > 35) {
    emit()
    return
  }

  const now = f.t
  const pt: TrackPoint = { lat: f.lat, lng: f.lng, t: now, alt: f.alt, acc: Math.round(f.acc), d: state.distance, a: activeMs(state, now) }

  if (!lastAccepted || breakNext) {
    if (breakNext && lastAccepted) pt.b = 1
    breakNext = false
    rejectStreak = 0
    acceptPoint(pt, 0, f)
    return
  }

  const dist = haversine([lastAccepted.lat, lastAccepted.lng], [f.lat, f.lng])
  const dt = (now - lastAccepted.t) / 1000
  if (dt <= 0) return
  const implied = dist / dt

  // jitter: tiny moves when standing still
  if (dist < Math.max(3, f.acc * 0.4) && dt < 15) {
    updateSpeed(f, 0, dt)
    handleAutoPause(now)
    emit()
    return
  }
  // teleport filter
  if (implied > 11 && dt < 60) {
    rejectStreak++
    if (rejectStreak >= 4) {
      breakNext = true
      rejectStreak = 0
    }
    emit()
    return
  }
  rejectStreak = 0
  if (dt > 20) {
    pt.g = 1
    state.gaps++
    notice(`Signal GPS retrouvé après ${spokenDuration(dt * 1000)} : ${spokenDistance(dist)} recollés en ligne droite.`)
  }
  acceptPoint(pt, dist, f, dt)
}

function updateSpeed(f: Fix, dist: number, dt: number) {
  let v = f.speed !== null && f.speed >= 0 && !isNaN(f.speed) ? f.speed : dist / Math.max(dt, 1)
  if (v > 12) v = state.speed
  state.speed = state.speed * 0.6 + v * 0.4
  if (state.speed < 0.25) state.speed = 0
}

function acceptPoint(pt: TrackPoint, dist: number, f: Fix, dt = 1) {
  const prevD = state.distance
  const prevA = lastAccepted?.a ?? 0
  state.distance += dist
  pt.d = state.distance
  pt.a = activeMs(state, pt.t)
  // elevation with hysteresis
  if (pt.alt !== null && (f.altAcc === null || f.altAcc < 20)) {
    if (altRef === null) altRef = pt.alt
    else if (pt.alt - altRef > 3) {
      state.elevGain += pt.alt - altRef
      altRef = pt.alt
    } else if (altRef - pt.alt > 3) altRef = pt.alt
  }
  if (!pt.g) updateSpeed(f, dist, dt)
  if (!pt.g && dt < 10) state.maxSpeed = Math.max(state.maxSpeed, Math.min(state.speed, 11))
  state.points.push(pt)
  lastAccepted = pt
  checkSplits(prevD, prevA, pt)
  handleAutoPause(pt.t)
  updateWorkout(pt.t)
  updateGhost()
  emit(true)
}

function handleAutoPause(now: number) {
  if (!getSettings().autoPause || state.status !== 'running') return
  if (state.speed < 0.7) {
    if (slowSince === null) slowSince = now
    if (!state.autoPaused && now - slowSince > 6000) {
      state.activeBase += slowSince - state.segStart
      state.autoPaused = true
      beep(440, 0.2)
      showBanner('PAUSE AUTO', 'Reprends ta course pour relancer le chrono', '#ffb020')
    }
  } else {
    slowSince = null
    if (state.autoPaused && state.speed > 1.1) {
      state.autoPaused = false
      state.segStart = now
      beep(880, 0.15)
      showBanner('REPRISE', undefined, '#7cfc6b')
    }
  }
}

function checkSplits(prevD: number, prevA: number, pt: TrackPoint) {
  const kmBefore = Math.floor(prevD / 1000)
  const kmNow = Math.floor(pt.d / 1000)
  for (let k = kmBefore + 1; k <= kmNow; k++) {
    const f = pt.d === prevD ? 1 : (k * 1000 - prevD) / (pt.d - prevD)
    const at = prevA + f * (pt.a - prevA)
    const prevAt = state.splits.length ? state.splits[state.splits.length - 1].at : 0
    const split: Split = { km: k, ms: at - prevAt, at }
    state.splits.push(split)
    const pace = split.ms / 1000
    showBanner(`KM ${k}`, `${fmtPace(pace)} /km`, '#ffb020')
    if (getSettings().announceKm) {
      let txt = `Kilomètre ${k}. Allure ${spokenPace(pace)}. Temps total ${spokenDuration(at)}.`
      if (state.ghost && getSettings().ghostVoice) {
        const gd = ghostDelta(state.ghost.points, at, k * 1000)
        if (gd) txt += gd.seconds >= 0 ? ` ${Math.round(gd.seconds)} secondes d'avance sur ton fantôme.` : ` ${Math.round(-gd.seconds)} secondes de retard sur ton fantôme.`
      }
      speak(txt)
    }
  }
}

function updateGhost() {
  if (!state.ghost) return
  const gd = ghostDelta(state.ghost.points, activeMs(), state.distance)
  if (!gd) return
  const ahead = state.ghostAhead
  if (ahead === null) {
    if (Math.abs(gd.meters) > 15) state.ghostAhead = gd.meters > 0
    return
  }
  if (ahead && gd.meters < -10) {
    state.ghostAhead = false
    showBanner('LE FANTÔME PASSE DEVANT', 'Accroche-toi !', '#a78bfa')
    if (getSettings().ghostVoice) speak('Ton fantôme vient de te dépasser ! Accroche-toi !')
  } else if (!ahead && gd.meters > 10) {
    state.ghostAhead = true
    showBanner('FANTÔME DÉPASSÉ', 'Garde le rythme', '#7cfc6b')
    if (getSettings().ghostVoice) speak('Tu as dépassé ton fantôme ! Garde le rythme !')
  }
}

/* ---------------- intervals ---------------- */
function stepIntro(i: number): string {
  const w = state.workout!
  const s = w.steps[i]
  const vma = getSettings().vma
  let txt = `${s.label}. ${stepValueLabel(s).replace('min', 'minutes').replace(/(\d+) s$/, '$1 secondes')}`
  if (s.pct && vma && (s.type === 'work' || s.type === 'test')) txt += `, allure ${spokenPace(kmhToPace((vma * s.pct) / 100))} au kilo`
  if (s.type === 'rest') txt = `Récupère. ${txt.replace(/^Récup[^.]*\. /, '')}`
  if (s.type === 'work' || s.type === 'test') txt = `Go ! ${txt}`
  return txt
}

function updateWorkout(now = Date.now()) {
  const w = state.workout
  if (!w || state.workoutDone || state.status !== 'running') return
  let changed = false
  for (;;) {
    const s = w.steps[state.stepIndex]
    const a = activeMs(state, now) - state.stepStartA
    const d = state.distance - state.stepStartD
    const done = s.kind === 'time' ? a >= s.value : d >= s.value
    if (!done) {
      // countdown beeps / alerts
      if (s.kind === 'time') {
        const rem = Math.ceil((s.value - a) / 1000)
        if (rem <= 3 && rem >= 1 && rem !== lastBeepSec) {
          lastBeepSec = rem
          beep(660, 0.12)
        }
      } else if (!announced100 && s.value >= 400 && s.value - d <= 100) {
        announced100 = true
        speak('Encore 100 mètres !')
      }
      break
    }
    const endA = s.kind === 'time' ? state.stepStartA + s.value : activeMs(state, now)
    const log: StepLog = { index: state.stepIndex, type: s.type, label: s.label, distance: d, ms: endA - state.stepStartA, pct: s.pct }
    state.stepLog.push(log)
    if (s.type === 'test') {
      state.vmaResult = Math.round((log.distance / 100) * 10) / 10
      speak(`Test terminé ! ${Math.round(log.distance)} mètres. Ta VMA est estimée à ${String(state.vmaResult).replace('.', ' virgule ')} kilomètres heure.`, { interrupt: true })
      showBanner(`VMA ${state.vmaResult} KM/H`, `${Math.round(log.distance)} m en 6 min`, '#ffb020')
    }
    state.stepIndex++
    state.stepStartA = endA
    state.stepStartD = state.distance
    lastBeepSec = -1
    announced100 = false
    changed = true
    if (state.stepIndex >= w.steps.length) {
      state.workoutDone = true
      state.stepIndex = w.steps.length - 1
      fanfare()
      showBanner('SÉANCE TERMINÉE', 'Respect +', '#7cfc6b')
      speak('Séance terminée ! Bravo, tu peux arrêter quand tu veux.', { interrupt: true })
      break
    }
  }
  if (changed && !state.workoutDone) {
    const s = w.steps[state.stepIndex]
    const intense = s.type === 'work' || s.type === 'test'
    if (intense) startBeep()
    else beep(520, 0.3)
    showBanner(s.label.toUpperCase(), stepValueLabel(s), intense ? '#ff3b5c' : s.type === 'rest' ? '#7cfc6b' : '#38bdf8')
    speak(stepIntro(state.stepIndex), { interrupt: true })
  }
}

export function skipStep() {
  const w = state.workout
  if (!w || state.workoutDone) return
  const s = w.steps[state.stepIndex]
  // force completion
  if (s.kind === 'time') state.stepStartA = activeMs() - s.value
  else state.stepStartD = state.distance - s.value
  updateWorkout()
  emit(true)
}

/* ---------------- lifecycle ---------------- */
function startTicker() {
  if (ticker !== null) clearInterval(ticker)
  ticker = window.setInterval(() => {
    if (state.status === 'running') {
      updateWorkout()
      updateGhost()
      // stale GPS detection
      if (Date.now() - lastFixAt > 15000 && state.gps !== 'off') state.gps = 'searching'
      emit()
      persist()
    }
  }, 1000)
}

/** Start GPS without recording, to get a fix before the run */
export function warmUpGps() {
  if (!source) startSource()
}
export function stopGpsIfIdle() {
  if (state.status === 'idle') {
    source?.stop()
    source = null
    state.gps = 'off'
    emit()
  }
}
export function restartGps() {
  source?.stop()
  source = null
  startSource()
}

export function startRun(opts: { workout: Workout | null; ghost: GhostRef | null }) {
  const now = Date.now()
  const pos = state.pos
  const gps = state.gps
  state = { ...blank(), pos, gps, status: 'running', startedAt: now, segStart: now, workout: opts.workout, ghost: opts.ghost }
  lastAccepted = null
  breakNext = false
  altRef = null
  slowSince = null
  lastBeepSec = -1
  announced100 = false
  sessionStorage.removeItem('rf-demo-dist')
  if (getSettings().demoGps) {
    // demo runner always starts at the beginning of its loop (handy to test the ghost)
    source?.stop()
    source = null
  }
  if (!source) startSource()
  // record current fix as first point
  if (!getSettings().demoGps && pos && Date.now() - pos.t < 10000 && pos.acc <= 35) {
    const p: TrackPoint = { lat: pos.lat, lng: pos.lng, t: now, alt: null, acc: pos.acc, d: 0, a: 0 }
    state.points.push(p)
    lastAccepted = p
  }
  startTicker()
  void keepAwake()
  startBeep()
  if (opts.workout) {
    showBanner('MISSION LANCÉE', opts.workout.name, '#ff3b5c')
    speak(`C'est parti pour ${opts.workout.name}. ${stepIntro(0)}`, { interrupt: true })
  } else {
    showBanner('C’EST PARTI', opts.ghost ? `Fantôme : ${opts.ghost.name}` : 'Course libre', '#7cfc6b')
    speak(opts.ghost ? 'Course lancée. Ton fantôme est en piste, à toi de le battre !' : 'Course lancée. Bonne course !', { interrupt: true })
  }
  emit(true)
  persist(true)
}

export function pauseRun() {
  if (state.status !== 'running') return
  const now = Date.now()
  if (!state.autoPaused) state.activeBase += now - state.segStart
  state.autoPaused = false
  state.status = 'paused'
  breakNext = true
  beep(440, 0.25)
  speak('Pause.')
  emit(true)
  persist(true)
}

export function resumeRun() {
  if (state.status !== 'paused') return
  state.status = 'running'
  state.segStart = Date.now()
  slowSince = null
  void keepAwake()
  beep(880, 0.2)
  speak('Reprise.')
  emit(true)
  persist(true)
}

export function discardRun() {
  localStorage.removeItem(ACTIVE_KEY)
  const pos = state.pos
  state = { ...blank(), pos, gps: state.gps }
  lastAccepted = null
  if (ticker !== null) clearInterval(ticker)
  ticker = null
  source?.stop()
  source = null
  state.gps = 'off'
  releaseAwake()
  emit()
}

export async function finishRun(): Promise<Run | null> {
  if (state.status === 'idle') return null
  const now = Date.now()
  if (state.status === 'running' && !state.autoPaused) {
    state.activeBase += now - state.segStart
  }
  state.status = 'paused'
  const s = state
  const settings = getSettings()
  const workoutCompleted = !!s.workout && (s.workoutDone || s.stepLog.some((l) => l.type === 'test'))
  const kind: Run['kind'] = s.workout ? (s.workout.id === 'vma-test' ? 'vma-test' : 'intervals') : 'free'
  let ghostDeltaS: number | undefined
  if (s.ghost && s.distance > 50) {
    // compare both runs on their common distance
    const common = Math.min(s.distance, s.ghost.distance)
    const myT = timeAtDist(s.points, common)
    const gT = timeAtDist(s.ghost.points, common)
    ghostDeltaS = Math.round((gT - myT) / 1000)
  }
  const d = new Date(s.startedAt)
  const h = d.getHours()
  const moment = h < 11 ? 'matinale' : h < 14 ? 'du midi' : h < 18 ? "de l'après-midi" : 'du soir'
  const run: Run = {
    id: `r${s.startedAt}`,
    name: s.workout ? s.workout.name : `Course ${moment}`,
    kind,
    startedAt: s.startedAt,
    endedAt: now,
    distance: Math.round(s.distance),
    activeMs: Math.round(s.activeBase),
    elapsedMs: now - s.startedAt,
    maxSpeed: s.maxSpeed,
    elevGain: Math.round(s.elevGain),
    calories: calories(s.distance, settings.weight),
    xp: 0,
    gaps: s.gaps,
    workoutName: s.workout?.name,
    ghostName: s.ghost?.name,
    ghostDelta: ghostDeltaS,
    vmaResult: s.vmaResult,
    points: s.points,
    splits: s.splits,
    stepLog: s.stepLog,
  }
  run.best1k = bestEffort(run.points, 1000)
  run.best5k = bestEffort(run.points, 5000)
  run.best10k = bestEffort(run.points, 10000)
  run.xp = computeXp({ ...run, workoutCompleted })
  const worth = run.points.length >= 2 && run.distance > 0
  if (worth) await saveRun(run)
  discardRun()
  return worth ? run : null
}

function timeAtDist(points: TrackPoint[], d: number): number {
  if (!points.length) return 0
  for (let i = 1; i < points.length; i++) {
    if (points[i].d >= d) {
      const p = points[i - 1],
        q = points[i]
      const f = q.d === p.d ? 0 : (d - p.d) / (q.d - p.d)
      return p.a + f * (q.a - p.a)
    }
  }
  return points[points.length - 1].a
}

/* resync when the app comes back to foreground */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persist(true)
    } else if (state.status !== 'idle') {
      // iOS may have frozen the geolocation watch: restart it
      restartGps()
      updateWorkout()
      emit()
    }
  })
  window.addEventListener('pagehide', () => persist(true))
}

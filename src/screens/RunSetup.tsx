import { useEffect, useMemo, useState } from 'react'
import Radar from '../components/Radar'
import { Sheet, Pill } from '../components/ui'
import { useLive, warmUpGps, stopGpsIfIdle, startRun, restartGps } from '../lib/tracker'
import { useSettings } from '../lib/settings'
import { useNav, setPendingGhost, setPendingWorkout, setTab, loadGhost, push } from '../lib/nav'
import { useRuns } from '../lib/storage'
import { PRESETS, useCustomWorkouts, workoutTotals } from '../lib/workouts'
import { fmtDate, fmtDuration, fmtKm, fmtPace } from '../lib/geo'
import { levelFromXp, totals, weekKm } from '../lib/game'
import { unlockAudio, beep } from '../lib/voice'
import { keepAwake } from '../lib/wakelock'
import type { GhostRef } from '../lib/tracker'

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = (navigator as unknown as { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches

export default function RunSetup() {
  const live = useLive()
  const settings = useSettings()
  const nav = useNav()
  const runs = useRuns()
  const custom = useCustomWorkouts()
  const [sheet, setSheet] = useState<'workout' | 'ghost' | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [ghost, setGhost] = useState<GhostRef | null>(null)

  useEffect(() => {
    warmUpGps()
    return () => stopGpsIfIdle()
  }, [settings.demoGps])

  useEffect(() => {
    if (nav.pendingGhostId) void loadGhost(nav.pendingGhostId).then(setGhost)
    else setGhost(null)
  }, [nav.pendingGhostId])

  const tot = useMemo(() => totals(runs), [runs])
  const lvl = levelFromXp(tot.xp)
  const wk = weekKm(runs)
  const w = nav.pendingWorkout

  const go = () => {
    unlockAudio()
    void keepAwake()
    let n = 3
    setCountdown(n)
    beep(660, 0.15)
    const iv = setInterval(() => {
      n--
      if (n <= 0) {
        clearInterval(iv)
        setCountdown(null)
        startRun({ workout: w, ghost })
        setPendingWorkout(null)
        setPendingGhost(null)
      } else {
        setCountdown(n)
        beep(660, 0.15)
      }
    }, 1000)
  }

  const gpsLabel = live.gpsError ? 'Erreur GPS' : live.gps === 'good' ? 'GPS excellent' : live.gps === 'ok' ? 'GPS correct' : live.gps === 'poor' ? 'GPS faible' : 'Recherche GPS…'
  const gpsColor = live.gps === 'good' ? '#7cfc6b' : live.gps === 'ok' ? '#ffb020' : '#ff3b5c'
  const ghostRuns = runs.filter((r) => r.distance > 50 && r.kind !== "vma-test")

  return (
    <div className="pt-safe flex min-h-full flex-col px-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-4xl uppercase leading-none tracking-wide">
            Run<span className="text-neon">Forest</span>
          </div>
          <div className="mt-1 text-xs text-white/50">
            Niv. {lvl.level} · {lvl.rank}
          </div>
        </div>
        <button onClick={() => push({ type: 'help' })} className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 ring-1 ring-white/10">
          ⓘ Écran éteint ?
        </button>
      </div>

      {isIos && !standalone && (
        <div className="mt-3 rounded-xl bg-amber/10 p-3 text-xs text-amber ring-1 ring-amber/30">
          <b>Installe l’appli :</b> bouton Partager <span className="inline-block rounded bg-amber/20 px-1">⬆︎</span> puis « Sur l’écran d’accueil ». En mode appli, l’écran reste allumé et tout est plus fluide.
        </div>
      )}

      <div className="mt-4 flex flex-col items-center">
        <Radar
          size={Math.min(270, window.innerWidth - 110)}
          pos={live.pos}
          heading={live.heading}
          rotate={settings.radarRotate}
          points={[]}
          ghostRoute={ghost?.points ?? null}
          zoom={15.6}
          bars={[
            { value: lvl.progress, color: '#7cfc6b' },
            { value: wk / Math.max(1, settings.weeklyGoalKm), color: '#38bdf8' },
          ]}
        />
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: gpsColor, boxShadow: `0 0 8px ${gpsColor}` }} />
          <span className="text-white/70">{gpsLabel}</span>
          {live.pos && <span className="text-white/35">± {Math.round(live.pos.acc)} m</span>}
          {settings.demoGps && <Pill color="#a78bfa">DÉMO</Pill>}
        </div>
        {live.gpsError && (
          <div className="mt-2 rounded-lg bg-hot/10 p-2 text-center text-xs text-hot">
            {live.gpsError}
            <button className="ml-2 underline" onClick={restartGps}>
              Réessayer
            </button>
          </div>
        )}
        <div className="mt-2 flex w-full max-w-xs justify-between text-[10px] uppercase tracking-widest text-white/40">
          <span>XP niv. {lvl.level + 1}</span>
          <span>
            Semaine {wk.toFixed(1)}/{settings.weeklyGoalKm} km
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => setSheet('workout')} className={`rounded-2xl p-3 text-left ring-1 ${w ? 'bg-hot/10 ring-hot/40' : 'bg-white/[0.04] ring-white/10'}`}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">Séance</div>
          <div className="mt-1 truncate font-semibold">{w ? `${w.emoji} ${w.name}` : 'Course libre'}</div>
          <div className="text-xs text-white/40">{w ? `${workoutTotals(w).work} efforts · ~${Math.round(workoutTotals(w).ms / 60000)} min` : 'Toucher pour fractionné'}</div>
        </button>
        <button onClick={() => setSheet('ghost')} className={`rounded-2xl p-3 text-left ring-1 ${ghost ? 'bg-ghost/10 ring-ghost/40' : 'bg-white/[0.04] ring-white/10'}`}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">Fantôme</div>
          <div className="mt-1 truncate font-semibold">{ghost ? `👻 ${ghost.name}` : 'Aucun'}</div>
          <div className="text-xs text-white/40">{ghost ? `${fmtKm(ghost.distance)} km · ${fmtDuration(ghost.totalMs)}` : 'Cours contre toi-même'}</div>
        </button>
      </div>

      <div className="mt-6 flex justify-center">
        <button onClick={go} className="pulse-ring grid h-28 w-28 place-items-center rounded-full bg-neon font-display text-4xl text-black shadow-[0_0_40px_rgba(124,252,107,.45)] active:scale-95">
          GO
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-white/40">Pendant la course, utilise le 🔒 mode poche plutôt que de verrouiller ton iPhone.</p>

      {countdown !== null && (
        <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/85">
          <div key={countdown} className="pop font-display text-[160px] leading-none text-neon">
            {countdown}
          </div>
        </div>
      )}

      <Sheet open={sheet === 'workout'} onClose={() => setSheet(null)} title="Choisir une séance">
        <button onClick={() => { setPendingWorkout(null); setSheet(null) }} className={`mb-2 w-full rounded-xl p-3 text-left ring-1 ${!w ? 'bg-neon/10 ring-neon/40' : 'bg-white/5 ring-white/10'}`}>
          <div className="font-semibold">🏃 Course libre</div>
          <div className="text-xs text-white/45">Pas de séance, juste toi et la route.</div>
        </button>
        {[...custom, ...PRESETS].map((p) => (
          <button key={p.id} onClick={() => { setPendingWorkout(p); setSheet(null) }} className={`mb-2 w-full rounded-xl p-3 text-left ring-1 ${w?.id === p.id ? 'bg-hot/10 ring-hot/40' : 'bg-white/5 ring-white/10'}`}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {p.emoji} {p.name}
              </div>
              <Pill color={p.level === 'Test' ? '#ffb020' : p.custom ? '#a78bfa' : '#38bdf8'}>{p.custom ? 'Perso' : p.level}</Pill>
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-white/45">{p.description}</div>
          </button>
        ))}
        <button onClick={() => { setSheet(null); setTab('intervals') }} className="mt-2 w-full rounded-xl bg-white/10 p-3 text-sm font-semibold">
          📘 Comprendre le fractionné / créer ma séance
        </button>
      </Sheet>

      <Sheet open={sheet === 'ghost'} onClose={() => setSheet(null)} title="Choisir un fantôme">
        <button onClick={() => { setPendingGhost(null); setSheet(null) }} className="mb-2 w-full rounded-xl bg-white/5 p-3 text-left ring-1 ring-white/10">
          <div className="font-semibold">Pas de fantôme</div>
        </button>
        {ghostRuns.length === 0 && <p className="py-4 text-center text-sm text-white/50">Termine une première course : elle deviendra ton fantôme. Tu peux aussi importer un GPX depuis l’historique.</p>}
        {ghostRuns.map((r) => (
          <button key={r.id} onClick={() => { setPendingGhost(r.id); setSheet(null) }} className={`mb-2 w-full rounded-xl p-3 text-left ring-1 ${nav.pendingGhostId === r.id ? 'bg-ghost/15 ring-ghost/50' : 'bg-white/5 ring-white/10'}`}>
            <div className="flex justify-between">
              <span className="truncate font-semibold">👻 {r.name}</span>
              <span className="text-xs text-white/45">{fmtDate(r.startedAt)}</span>
            </div>
            <div className="text-xs text-white/50">
              {fmtKm(r.distance)} km · {fmtDuration(r.activeMs)} · {fmtPace(r.activeMs / 1000 / (r.distance / 1000))}/km
            </div>
          </button>
        ))}
      </Sheet>
    </div>
  )
}

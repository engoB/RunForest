import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Radar from '../components/Radar'
import RunMap from '../components/RunMap'
import { Bar, HoldButton, Sheet, Stars } from '../components/ui'
import { activeMs, discardRun, finishRun, pauseRun, resumeRun, skipStep, useLive } from '../lib/tracker'
import { useSettings } from '../lib/settings'
import { fmtDuration, fmtKm, fmtPace, msToKmh, speedToPace } from '../lib/geo'
import { ghostDelta } from '../lib/ghost'
import { intensityStars, weekKm } from '../lib/game'
import { STEP_COLORS, stepValueLabel, targetPace } from '../lib/workouts'
import { useRuns } from '../lib/storage'
import { isAwake, keepAwake, onAwakeChange } from '../lib/wakelock'
import { unlockAudio } from '../lib/voice'
import type { Run } from '../lib/types'

export default function RunHud({ onFinished }: { onFinished: (run: Run | null) => void }) {
  const live = useLive()
  const settings = useSettings()
  const runs = useRuns()
  const [pocket, setPocket] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [stopSheet, setStopSheet] = useState(false)
  const [awake, setAwake] = useState(isAwake())
  const [busy, setBusy] = useState(false)
  useEffect(() => onAwakeChange(setAwake), [])

  const now = Date.now()
  const act = activeMs(live, now)
  const avgPace = live.distance > 30 ? act / 1000 / (live.distance / 1000) : 0
  const curPace = speedToPace(live.speed)
  const running = live.status === 'running'
  const paused = live.status === 'paused' || live.autoPaused

  const gd = useMemo(() => (live.ghost ? ghostDelta(live.ghost.points, act, live.distance) : null), [live.ghost, act, live.distance])

  // interval
  const w = live.workout
  const step = w ? w.steps[live.stepIndex] : null
  const next = w && !live.workoutDone ? w.steps[live.stepIndex + 1] : null
  let stepProgress = 0
  let stepRemain = ''
  if (step && !live.workoutDone) {
    if (step.kind === 'time') {
      const el = act - live.stepStartA
      stepProgress = el / step.value
      stepRemain = fmtDuration(Math.max(0, step.value - el) + 999)
    } else {
      const d = live.distance - live.stepStartD
      stepProgress = d / step.value
      stepRemain = `${Math.max(0, Math.round(step.value - d))} m`
    }
  }
  const tgt = step ? targetPace(step.pct, settings.vma) : null
  let paceHint: { txt: string; color: string } | null = null
  if (tgt && curPace && (step?.type === 'work' || step?.type === 'test')) {
    const r = curPace / tgt
    paceHint = r > 1.05 ? { txt: '▲ ACCÉLÈRE', color: '#ff3b5c' } : r < 0.93 ? { txt: '▼ TROP VITE', color: '#38bdf8' } : { txt: '● PILE DANS L’ALLURE', color: '#7cfc6b' }
  }
  const stepColor = step ? STEP_COLORS[step.type] : '#fff'

  const kmProgress = (live.distance % 1000) / 1000
  const wk = weekKm(runs) + live.distance / 1000
  const stars = running && !live.autoPaused ? intensityStars(live.speed, settings.vma) : 0

  const finish = async () => {
    setBusy(true)
    const run = await finishRun()
    setBusy(false)
    onFinished(run)
  }

  const gpsColor = live.gps === 'good' ? '#7cfc6b' : live.gps === 'ok' ? '#ffb020' : '#ff3b5c'
  const midRef = useRef<HTMLDivElement>(null)
  const [radarSize, setRadarSize] = useState(0)
  useLayoutEffect(() => {
    const el = midRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      // leave room for the bars under the radar
      const sz = Math.floor(Math.min(r.width * 0.9, r.height - 30, 340))
      setRadarSize((prev) => (Math.abs(prev - sz) > 6 ? Math.max(120, sz) : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="pt-safe pb-safe relative flex h-full flex-col overflow-hidden px-3">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/10">
          <span className="h-2 w-2 rounded-full" style={{ background: gpsColor, boxShadow: `0 0 8px ${gpsColor}` }} />
          GPS {live.pos ? `±${Math.round(live.pos.acc)}m` : '…'}
          {!awake && (
            <button onClick={() => { unlockAudio(); void keepAwake() }} className="ml-1 rounded bg-amber px-1.5 text-black">
              ☀︎ écran
            </button>
          )}
        </div>
        <Stars n={stars} size={20} />
      </div>

      {/* banner */}
      {live.banner && (
        <div key={live.banner.id} className="pop pointer-events-none absolute inset-x-0 top-[48%] z-30 text-center">
          <div className="hud-stroke font-display text-5xl uppercase tracking-wide drop-shadow-[0_4px_0_#000]" style={{ color: live.banner.color }}>
            {live.banner.title}
          </div>
          {live.banner.sub && <div className="mt-1 text-lg font-bold text-white text-shadow-hud">{live.banner.sub}</div>}
        </div>
      )}
      {live.notice && <div className="slide-down mt-2 rounded-xl bg-sky-500/15 p-2 text-xs text-sky-200 ring-1 ring-sky-400/30">{live.notice}</div>}

      {/* main stats */}
      <div className="mt-2 text-center">
        <div className={`font-display tabular text-[64px] leading-none tracking-wide ${paused ? 'animate-pulse text-amber' : ''}`}>{fmtDuration(act)}</div>
        <div className="mt-1 flex items-baseline justify-center gap-1">
          <span className="font-display tabular text-5xl leading-none text-neon">{fmtKm(live.distance)}</span>
          <span className="text-sm text-white/50">km</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Mini label="Allure" value={fmtPace(curPace)} unit="/km" />
        <Mini label="Moyenne" value={fmtPace(avgPace)} unit="/km" />
        <Mini label="Vitesse" value={msToKmh(live.speed).toFixed(1)} unit="km/h" />
      </div>

      {/* interval card */}
      {w && step && (
        <div className="mt-2 rounded-2xl p-3 ring-1" style={{ background: `${stepColor}14`, borderColor: stepColor, boxShadow: `inset 0 0 0 1px ${stepColor}55` }}>
          {live.workoutDone ? (
            <div className="text-center">
              <div className="font-display text-2xl uppercase text-neon">Séance terminée 🏆</div>
              <div className="text-xs text-white/60">Tu peux continuer à trottiner ou arrêter.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: stepColor }}>
                    Étape {live.stepIndex + 1}/{w.steps.length}
                  </div>
                  <div className="truncate font-display text-xl uppercase leading-tight">{step.label}</div>
                </div>
                <div className="font-display tabular text-4xl leading-none" style={{ color: stepColor }}>
                  {stepRemain}
                </div>
              </div>
              <div className="mt-2">
                <Bar value={stepProgress} color={stepColor} h={7} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/60">{tgt ? `Cible ${fmtPace(tgt)}/km` : step.pct ? `${step.pct}% VMA (règle ta VMA)` : ''}</span>
                {paceHint && <span className="font-bold" style={{ color: paceHint.color }}>{paceHint.txt}</span>}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                <span className="truncate">{next ? `Ensuite : ${next.label} · ${stepValueLabel(next)}` : 'Dernière étape'}</span>
                <button onClick={skipStep} className="ml-2 shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/70">
                  Passer ⏭
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ghost */}
      {gd && (
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-ghost/10 px-3 py-2 ring-1 ring-ghost/30">
          <div className="text-2xl">👻</div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ghost">{live.ghost!.name}</div>
            <div className="text-xs text-white/55">{gd.finished ? 'Fantôme arrivé' : `${Math.abs(Math.round(gd.meters))} m ${gd.meters >= 0 ? 'd’avance' : 'de retard'}`}</div>
          </div>
          <div className={`font-display tabular text-3xl ${gd.seconds >= 0 ? 'text-neon' : 'text-hot'}`}>
            {gd.seconds >= 0 ? '+' : '−'}
            {fmtDuration(Math.abs(gd.seconds) * 1000)}
          </div>
        </div>
      )}

      {/* radar fills the remaining space */}
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
        <Mini label="D+" value={`${Math.round(live.elevGain)}`} unit="m" />
        <Mini label="Kcal" value={`${Math.round((live.distance / 1000) * settings.weight * 1.036)}`} />
        <Mini label="Max" value={msToKmh(live.maxSpeed).toFixed(1)} />
        <Mini label="Dern. km" value={live.splits.length ? fmtPace(live.splits[live.splits.length - 1].ms / 1000) : "--'--"} />
      </div>
      <div ref={midRef} className="relative flex min-h-0 flex-1 items-center justify-center py-2">
        {radarSize > 0 && (
          <Radar
            size={radarSize}
            pos={live.pos}
            heading={live.heading}
            rotate={settings.radarRotate}
            points={live.points}
            ghost={gd ? { lat: gd.lat, lng: gd.lng } : null}
            ghostRoute={live.ghost?.points ?? null}
            onClick={() => setMapOpen(true)}
            zoom={radarSize > 220 ? 16.6 : 16.2}
            bars={[
              { value: w && !live.workoutDone ? stepProgress : kmProgress, color: '#7cfc6b' },
              { value: wk / Math.max(1, settings.weeklyGoalKm), color: '#38bdf8' },
            ]}
          />
        )}
        {radarSize > 0 && <div className="pointer-events-none absolute bottom-1 right-0 text-[9px] uppercase tracking-widest text-white/30">toucher = carte</div>}
      </div>

      {/* controls */}
      <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 pb-1">
        <button onClick={() => setPocket(true)} className="h-16 rounded-2xl bg-white/10 text-2xl ring-1 ring-white/15 active:scale-95" aria-label="Mode poche">
          🔒
        </button>
        {live.status === 'paused' ? (
          <button onClick={resumeRun} className="h-16 rounded-2xl bg-neon font-display text-2xl uppercase text-black active:scale-95">
            ▶ Reprendre
          </button>
        ) : (
          <button onClick={pauseRun} className="h-16 rounded-2xl bg-amber font-display text-2xl uppercase text-black active:scale-95">
            ❚❚ Pause
          </button>
        )}
        <button onClick={() => setStopSheet(true)} className="h-16 rounded-2xl bg-hot/90 font-display text-xl uppercase active:scale-95">
          ■ Stop
        </button>
      </div>

      {/* pocket mode */}
      {pocket && (
        <div className="fixed inset-0 z-[1500] flex flex-col items-center justify-between bg-black p-8 pt-24 pb-16 text-white/35" onContextMenu={(e) => e.preventDefault()}>
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em]">Mode poche</div>
            <div className="mt-6 font-display tabular text-7xl text-white/50">{fmtDuration(act)}</div>
            <div className="mt-2 font-display tabular text-4xl text-white/40">{fmtKm(live.distance)} km</div>
            <div className="mt-2 text-lg">{fmtPace(curPace)} /km</div>
            {step && !live.workoutDone && (
              <div className="mt-6 text-xl" style={{ color: `${stepColor}aa` }}>
                {step.label} · {stepRemain}
              </div>
            )}
            {gd && <div className="mt-3 text-lg text-ghost/60">👻 {gd.seconds >= 0 ? '+' : '−'}{fmtDuration(Math.abs(gd.seconds) * 1000)}</div>}
          </div>
          <div className="text-center text-xs leading-relaxed">
            Écran noir pour économiser la batterie (OLED).<br />Le GPS continue. Ne verrouille pas l’iPhone.
          </div>
          <HoldButton onDone={() => setPocket(false)} ms={1500} color="#7cfc6b" className="w-64 rounded-full bg-white/5 px-6 py-4 text-sm font-semibold text-white/60 ring-1 ring-white/15">
            Maintenir pour déverrouiller
          </HoldButton>
        </div>
      )}

      {/* full map */}
      {mapOpen && (
        <div className="fixed inset-0 z-[1200] bg-ink">
          <RunMap className="absolute inset-0" points={live.points} ghostRoute={live.ghost?.points} ghost={gd ? { lat: gd.lat, lng: gd.lng } : null} pos={live.pos} follow />
          <button onClick={() => setMapOpen(false)} className="pt-safe absolute right-4 top-0 z-[500] mt-3 rounded-full bg-black/80 px-4 py-2 font-semibold ring-1 ring-white/20">
            ✕ Fermer
          </button>
          <div className="pb-safe absolute inset-x-3 bottom-3 z-[500] grid grid-cols-3 gap-2 text-center">
            <Mini label="Temps" value={fmtDuration(act)} />
            <Mini label="Km" value={fmtKm(live.distance)} />
            <Mini label="Allure" value={fmtPace(curPace)} />
          </div>
        </div>
      )}

      <Sheet open={stopSheet} onClose={() => setStopSheet(false)} title="Terminer la course ?">
        <div className="mb-4 text-sm text-white/60">
          {fmtKm(live.distance)} km en {fmtDuration(act)}
        </div>
        <button disabled={busy} onClick={finish} className="mb-2 h-14 w-full rounded-2xl bg-neon font-display text-xl uppercase text-black">
          ✔ Terminer et enregistrer
        </button>
        <button onClick={() => setStopSheet(false)} className="mb-2 h-12 w-full rounded-2xl bg-white/10 font-semibold">
          Continuer à courir
        </button>
        <HoldButton onDone={() => { discardRun(); setStopSheet(false); onFinished(null) }} className="h-12 w-full rounded-2xl bg-hot/15 font-semibold text-hot">
          Maintenir pour supprimer sans sauver
        </HoldButton>
      </Sheet>
    </div>
  )
}

function Mini({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-black/50 px-1 py-1.5 ring-1 ring-white/10">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className="font-display tabular text-2xl leading-tight">
        {value}
        {unit && <span className="ml-0.5 font-sans text-[10px] text-white/40">{unit}</span>}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Header, Pill, Sheet } from '../components/ui'
import { PRESETS, STEP_COLORS, buildSteps, deleteCustomWorkout, saveCustomWorkout, stepTarget, stepValueLabel, useCustomWorkouts, workoutTotals, type BuilderParams } from '../lib/workouts'
import { setSettings, useSettings } from '../lib/settings'
import { fmtPace, kmhToPace } from '../lib/geo'
import { pop, push, setPendingWorkout, setTab } from '../lib/nav'
import type { Workout } from '../lib/types'

export default function Intervals() {
  const settings = useSettings()
  const custom = useCustomWorkouts()
  const [vmaOpen, setVmaOpen] = useState(false)

  return (
    <div className="pb-28">
      <Header title="Fractionné" />
      <div className="px-4">
        <button onClick={() => push({ type: 'guide' })} className="w-full rounded-2xl bg-gradient-to-br from-ice/25 to-ghost/20 p-4 text-left ring-1 ring-ice/30">
          <div className="text-3xl">📘</div>
          <div className="mt-1 font-display text-2xl uppercase">Le guide du fractionné</div>
          <div className="text-sm text-white/60">C’est quoi, pourquoi, comment s’y prendre, la VMA, les erreurs à éviter. Lis-le avant ta première séance.</div>
        </button>

        <button onClick={() => setVmaOpen(true)} className="mt-3 flex w-full items-center gap-4 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-amber/15 ring-2 ring-amber/50">
            <div className="text-center">
              <div className="font-display text-2xl leading-none text-amber">{settings.vma ?? '?'}</div>
              <div className="text-[9px] text-amber/70">km/h</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="font-semibold">Ta VMA</div>
            <div className="text-xs text-white/50">{settings.vma ? 'Toutes les allures cibles sont calculées à partir d’elle. Toucher pour voir tes allures.' : 'Pas encore définie : fais le test VMA (ci-dessous) ou entre une estimation.'}</div>
          </div>
        </button>

        {custom.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">Mes séances</h2>
            {custom.map((w) => (
              <WorkoutCard key={w.id} w={w} />
            ))}
          </>
        )}

        <button onClick={() => push({ type: 'builder' })} className="mt-6 w-full rounded-2xl border-2 border-dashed border-white/15 p-4 font-semibold text-white/70">
          ＋ Créer ma séance
        </button>

        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">Séances prêtes</h2>
        {PRESETS.map((w) => (
          <WorkoutCard key={w.id} w={w} />
        ))}
      </div>

      <Sheet open={vmaOpen} onClose={() => setVmaOpen(false)} title="Ma VMA">
        <label className="text-xs text-white/50">VMA (km/h)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="6"
          max="25"
          defaultValue={settings.vma ?? ''}
          placeholder="ex : 14"
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            setSettings({ vma: isNaN(v) ? null : Math.min(25, Math.max(6, v)) })
          }}
          className="mt-1 w-full rounded-xl bg-white/10 p-3 text-2xl outline-none ring-1 ring-white/15 focus:ring-amber"
        />
        <p className="mt-2 text-xs text-white/45">Pas d’idée ? Débutant : 11-13 · Régulier : 13-16 · Confirmé : 16-19. Le mieux reste le test VMA de 6 min.</p>
        {settings.vma && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-white/40">
                <th className="py-1">Zone</th>
                <th>% VMA</th>
                <th>km/h</th>
                <th>Allure</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Récup / footing lent', 60],
                ['Endurance fondamentale', 70],
                ['Marathon', 78],
                ['Semi / Seuil', 85],
                ['10 km', 90],
                ['VMA longue', 95],
                ['VMA', 100],
                ['VMA courte', 105],
              ].map(([n, p]) => (
                <tr key={n as string} className="border-t border-white/5">
                  <td className="py-1.5 text-white/70">{n}</td>
                  <td>{p}%</td>
                  <td>{((settings.vma! * (p as number)) / 100).toFixed(1)}</td>
                  <td className="font-semibold text-amber">{fmtPace(kmhToPace((settings.vma! * (p as number)) / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sheet>
    </div>
  )
}

function WorkoutCard({ w }: { w: Workout }) {
  const t = workoutTotals(w)
  return (
    <button onClick={() => push({ type: 'workout', workout: w })} className="mb-2 w-full rounded-2xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 active:bg-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate font-semibold">
          {w.emoji} {w.name}
        </div>
        <Pill color={w.level === 'Test' ? '#ffb020' : w.custom ? '#a78bfa' : w.level === 'Débutant' ? '#7cfc6b' : w.level === 'Confirmé' ? '#ff3b5c' : '#38bdf8'}>{w.custom ? 'Perso' : w.level}</Pill>
      </div>
      <div className="mt-0.5 text-xs text-white/50">
        {w.goal} · {t.work} effort{t.work > 1 ? 's' : ''} · ~{Math.round(t.ms / 60000)} min{t.m ? ` + ${(t.m / 1000).toFixed(1)} km` : ''}
      </div>
      <StepStrip w={w} />
    </button>
  )
}

export function StepStrip({ w }: { w: Workout }) {
  // proportional bar (distance steps converted at ~5 min/km)
  const dur = (s: Workout['steps'][number]) => (s.kind === 'time' ? s.value : s.value * 300)
  const total = w.steps.reduce((a, s) => a + dur(s), 0)
  return (
    <div className="mt-2 flex h-3 w-full items-end gap-px overflow-hidden rounded">
      {w.steps.map((s, i) => (
        <div key={i} style={{ width: `${(dur(s) / total) * 100}%`, background: STEP_COLORS[s.type], height: s.type === 'work' || s.type === 'test' ? '100%' : s.type === 'rest' ? '45%' : '65%' }} />
      ))}
    </div>
  )
}

export function WorkoutDetail({ w }: { w: Workout }) {
  const settings = useSettings()
  const t = workoutTotals(w)
  return (
    <div className="pb-32">
      <Header title={w.name} onBack={pop} />
      <div className="px-4">
        <div className="text-5xl">{w.emoji}</div>
        <p className="mt-2 text-sm text-white/70">{w.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill color="#38bdf8">{w.goal}</Pill>
          <Pill color="#ffb020">~{Math.round(t.ms / 60000)} min{t.m ? ` + ${(t.m / 1000).toFixed(1)} km` : ''}</Pill>
          <Pill color="#ff3b5c">{t.work} efforts</Pill>
        </div>
        {!settings.vma && <div className="mt-3 rounded-xl bg-amber/10 p-3 text-xs text-amber ring-1 ring-amber/30">Définis ta VMA (onglet Fractionné) pour avoir tes allures cibles en min/km et le coach « accélère / ralentis ».</div>}
        <StepStrip w={w} />
        <div className="mt-4 space-y-1.5">
          {w.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="h-8 w-1.5 rounded-full" style={{ background: STEP_COLORS[s.type] }} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{s.label}</div>
                {s.hint && <div className="text-[11px] text-white/40">{s.hint}</div>}
              </div>
              <div className="text-right">
                <div className="font-display text-lg leading-none">{stepValueLabel(s)}</div>
                <div className="text-[11px] text-white/50">{stepTarget(s, settings.vma)}</div>
              </div>
            </div>
          ))}
        </div>
        {w.custom && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => push({ type: 'builder', workout: w })} className="rounded-xl bg-white/10 py-3 text-sm font-semibold">
              ✎ Modifier
            </button>
            <button
              onClick={() => {
                deleteCustomWorkout(w.id)
                pop()
              }}
              className="rounded-xl bg-hot/15 py-3 text-sm font-semibold text-hot"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink to-transparent px-4 pt-6">
        <button
          onClick={() => {
            setPendingWorkout(w)
            setTab('run')
          }}
          className="h-14 w-full rounded-2xl bg-hot font-display text-2xl uppercase active:scale-[.98]"
        >
          Lancer cette séance
        </button>
      </div>
    </div>
  )
}

const defaultParams: BuilderParams = { name: 'Ma séance', warmupMin: 15, sets: 1, reps: 8, workKind: 'time', workValue: 30, workPct: 100, restKind: 'time', restValue: 30, setRestMin: 3, cooldownMin: 10 }

export function Builder({ edit }: { edit?: Workout }) {
  const [p, setP] = useState<BuilderParams>(() => (edit as unknown as { params?: BuilderParams })?.params ?? defaultParams)
  const settings = useSettings()
  const up = (patch: Partial<BuilderParams>) => setP((x) => ({ ...x, ...patch }))
  const steps = buildSteps(p)
  const w: Workout = { id: edit?.id ?? `c${Date.now()}`, name: p.name || 'Ma séance', emoji: '🛠️', level: 'Intermédiaire', goal: p.workPct >= 98 ? 'VMA courte' : p.workPct >= 88 ? 'VMA longue' : 'Seuil', description: `${p.sets > 1 ? `${p.sets} × ` : ''}${p.reps} × ${p.workKind === 'time' ? `${p.workValue} s` : `${p.workValue} m`} à ${p.workPct}% VMA, récup ${p.restKind === 'time' ? `${p.restValue} s` : `${p.restValue} m`}.`, steps, custom: true }
  const tp = settings.vma ? fmtPace(kmhToPace((settings.vma * p.workPct) / 100)) : null

  return (
    <div className="pb-32">
      <Header title={edit ? 'Modifier' : 'Créer ma séance'} onBack={pop} />
      <div className="space-y-3 px-4">
        <input value={p.name} onChange={(e) => up({ name: e.target.value })} className="w-full rounded-xl bg-white/10 p-3 font-semibold outline-none ring-1 ring-white/15" />
        <Row label="Échauffement" value={`${p.warmupMin} min`} onMinus={() => up({ warmupMin: Math.max(0, p.warmupMin - 5) })} onPlus={() => up({ warmupMin: p.warmupMin + 5 })} />
        <Row label="Séries" value={`${p.sets}`} onMinus={() => up({ sets: Math.max(1, p.sets - 1) })} onPlus={() => up({ sets: Math.min(6, p.sets + 1) })} />
        <Row label="Répétitions / série" value={`${p.reps}`} onMinus={() => up({ reps: Math.max(1, p.reps - 1) })} onPlus={() => up({ reps: Math.min(30, p.reps + 1) })} />
        <div className="rounded-2xl bg-hot/10 p-3 ring-1 ring-hot/30">
          <Seg value={p.workKind} onChange={(v) => up({ workKind: v, workValue: v === 'time' ? 30 : 400 })} />
          <Row label="Effort" value={p.workKind === 'time' ? fmtSec(p.workValue) : `${p.workValue} m`} onMinus={() => up({ workValue: Math.max(p.workKind === 'time' ? 10 : 100, p.workValue - (p.workKind === 'time' ? (p.workValue > 60 ? 30 : 10) : 100)) })} onPlus={() => up({ workValue: p.workValue + (p.workKind === 'time' ? (p.workValue >= 60 ? 30 : 10) : 100) })} />
          <Row label="Intensité" value={`${p.workPct}% VMA`} sub={tp ? `${tp}/km` : undefined} onMinus={() => up({ workPct: Math.max(70, p.workPct - 5) })} onPlus={() => up({ workPct: Math.min(110, p.workPct + 5) })} />
        </div>
        <div className="rounded-2xl bg-neon/10 p-3 ring-1 ring-neon/30">
          <Seg value={p.restKind} onChange={(v) => up({ restKind: v, restValue: v === 'time' ? 30 : 200 })} />
          <Row label="Récup" value={p.restKind === 'time' ? fmtSec(p.restValue) : `${p.restValue} m`} onMinus={() => up({ restValue: Math.max(0, p.restValue - (p.restKind === 'time' ? 15 : 100)) })} onPlus={() => up({ restValue: p.restValue + (p.restKind === 'time' ? 15 : 100) })} />
        </div>
        {p.sets > 1 && <Row label="Récup entre séries" value={`${p.setRestMin} min`} onMinus={() => up({ setRestMin: Math.max(1, p.setRestMin - 1) })} onPlus={() => up({ setRestMin: p.setRestMin + 1 })} />}
        <Row label="Retour au calme" value={`${p.cooldownMin} min`} onMinus={() => up({ cooldownMin: Math.max(0, p.cooldownMin - 5) })} onPlus={() => up({ cooldownMin: p.cooldownMin + 5 })} />
        <StepStrip w={w} />
        <p className="text-xs text-white/45">Règle d’or : récup ≈ durée de l’effort pour les efforts courts (30/30), moitié pour les efforts longs (3 min → 1 min 30).</p>
      </div>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink to-transparent px-4 pt-6">
        <button
          onClick={() => {
            const saved = { ...w, params: p } as Workout
            saveCustomWorkout(saved)
            pop()
            if (edit) pop()
            push({ type: 'workout', workout: saved })
          }}
          className="h-14 w-full rounded-2xl bg-neon font-display text-2xl uppercase text-black"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

const fmtSec = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60}` : ''}`)

function Row({ label, value, sub, onMinus, onPlus }: { label: string; value: string; sub?: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 text-sm text-white/70">{label}</div>
      <button onClick={onMinus} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl active:bg-white/20">
        −
      </button>
      <div className="w-24 text-center">
        <div className="font-display text-xl leading-none">{value}</div>
        {sub && <div className="text-[10px] text-white/45">{sub}</div>}
      </div>
      <button onClick={onPlus} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl active:bg-white/20">
        +
      </button>
    </div>
  )
}

function Seg({ value, onChange }: { value: 'time' | 'distance'; onChange: (v: 'time' | 'distance') => void }) {
  return (
    <div className="mb-1 grid grid-cols-2 rounded-lg bg-black/40 p-0.5 text-xs font-semibold">
      {(['time', 'distance'] as const).map((k) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-md py-1.5 ${value === k ? 'bg-white/15' : 'text-white/50'}`}>
          {k === 'time' ? '⏱ Temps' : '📏 Distance'}
        </button>
      ))}
    </div>
  )
}

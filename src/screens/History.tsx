import { useEffect, useMemo, useRef, useState } from 'react'
import { Header, Pill, Sheet } from '../components/ui'
import RunMap from '../components/RunMap'
import { deleteRun, getRun, renameRun, saveRun, useRuns } from '../lib/storage'
import { fmtDate, fmtDuration, fmtKm, fmtPace, fmtTime, msToKmh } from '../lib/geo'
import { pop, push, setPendingGhost, setTab } from '../lib/nav'
import { fromGpx, shareGpx } from '../lib/gpx'
import type { Run, RunSummary } from '../lib/types'
import { STEP_COLORS } from '../lib/workouts'

const kindLabel: Record<RunSummary['kind'], [string, string]> = {
  free: ['Libre', '#7cfc6b'],
  intervals: ['Fractionné', '#ff3b5c'],
  'vma-test': ['Test VMA', '#ffb020'],
  imported: ['Importé', '#a78bfa'],
}

export default function History() {
  const runs = useRuns()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const groups = useMemo(() => {
    const g = new Map<string, RunSummary[]>()
    for (const r of runs) {
      const k = new Date(r.startedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(r)
    }
    return [...g.entries()]
  }, [runs])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const run = fromGpx(await f.text(), f.name.replace(/\.gpx$/i, ''))
      await saveRun(run)
      setMsg(`« ${run.name} » importé (${fmtKm(run.distance)} km). Tu peux l’utiliser comme fantôme.`)
    } catch (e) {
      setMsg((e as Error).message)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="pb-28">
      <Header
        title="Historique"
        right={
          <button onClick={() => fileRef.current?.click()} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            ⤓ Importer GPX
          </button>
        }
      />
      <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="px-4">
        {msg && (
          <div className="mb-3 rounded-xl bg-ghost/10 p-3 text-sm text-ghost ring-1 ring-ghost/30" onClick={() => setMsg(null)}>
            {msg}
          </div>
        )}
        {runs.length === 0 && (
          <div className="mt-16 text-center text-white/50">
            <div className="text-6xl">🏁</div>
            <p className="mt-3">Aucune course pour l’instant.</p>
            <button onClick={() => setTab('run')} className="mt-4 rounded-full bg-neon px-6 py-3 font-display text-xl uppercase text-black">
              Première sortie
            </button>
          </div>
        )}
        {groups.map(([month, list]) => (
          <div key={month}>
            <div className="mb-2 mt-4 flex justify-between text-xs font-bold uppercase tracking-widest text-white/45">
              <span>{month}</span>
              <span>{fmtKm(list.reduce((a, r) => a + r.distance, 0), 1)} km</span>
            </div>
            {list.map((r) => (
              <button key={r.id} onClick={() => push({ type: 'run-detail', id: r.id })} className="mb-2 w-full rounded-2xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 active:bg-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-semibold">{r.name}</div>
                  <Pill color={kindLabel[r.kind][1]}>{kindLabel[r.kind][0]}</Pill>
                </div>
                <div className="mt-0.5 text-xs text-white/40">
                  {fmtDate(r.startedAt)} · {fmtTime(r.startedAt)}
                  {r.ghostDelta !== undefined && <span className={r.ghostDelta > 0 ? 'text-neon' : 'text-ghost'}> · 👻 {r.ghostDelta > 0 ? 'battu' : 'perdu'}</span>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <span className="font-display text-2xl">{fmtKm(r.distance)}</span>
                    <span className="ml-0.5 text-[10px] text-white/40">km</span>
                  </div>
                  <div className="font-display text-2xl">{fmtDuration(r.activeMs)}</div>
                  <div>
                    <span className="font-display text-2xl">{fmtPace(r.distance ? r.activeMs / r.distance : 0)}</span>
                    <span className="ml-0.5 text-[10px] text-white/40">/km</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<Run | null | undefined>(undefined)
  const [menu, setMenu] = useState(false)
  const [name, setName] = useState('')
  useEffect(() => {
    void getRun(id).then((r) => {
      setRun(r ?? null)
      setName(r?.name ?? '')
    })
  }, [id])

  const kmMarkers = useMemo(() => {
    if (!run) return []
    return run.splits.map((s) => {
      const p = run.points.find((x) => x.d >= s.km * 1000) ?? run.points[run.points.length - 1]
      return { lat: p.lat, lng: p.lng, label: `${s.km}` }
    })
  }, [run])

  if (run === undefined) return <Header title="…" onBack={pop} />
  if (run === null)
    return (
      <div>
        <Header title="Introuvable" onBack={pop} />
      </div>
    )

  const pace = run.distance ? run.activeMs / run.distance : 0
  const fastest = run.splits.length ? Math.min(...run.splits.map((s) => s.ms)) : 0
  const slowest = run.splits.length ? Math.max(...run.splits.map((s) => s.ms)) : 0

  return (
    <div className="pb-20">
      <Header
        title={run.name}
        onBack={pop}
        right={
          <button onClick={() => setMenu(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl">
            ⋯
          </button>
        }
      />
      <div className="px-4">
        <div className="text-xs text-white/45">
          {new Date(run.startedAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {fmtTime(run.startedAt)}
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <RunMap points={run.points} colorByPace className="h-64 w-full" markers={kmMarkers} />
        </div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/40">
          lent <span className="h-1.5 w-20 rounded bg-gradient-to-r from-ice via-neon to-hot" /> rapide
          {run.gaps > 0 && <span className="ml-2">· pointillés gris = signal perdu</span>}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <S label="Distance" v={fmtKm(run.distance)} u="km" />
          <S label="Temps" v={fmtDuration(run.activeMs)} />
          <S label="Allure moy." v={fmtPace(pace)} u="/km" />
          <S label="Vitesse max" v={msToKmh(run.maxSpeed).toFixed(1)} u="km/h" />
          <S label="Dénivelé +" v={`${run.elevGain}`} u="m" />
          <S label="Calories" v={`${run.calories}`} u="kcal" />
        </div>
        {run.elapsedMs - run.activeMs > 60000 && <div className="mt-1 text-right text-[11px] text-white/35">Temps total écoulé {fmtDuration(run.elapsedMs)} (pauses incluses)</div>}

        {(run.best1k || run.best5k || run.best10k) && (
          <div className="mt-3 flex gap-2">
            {run.best1k && <Pill color="#ffb020">⚡ Meilleur 1 km {fmtDuration(run.best1k)}</Pill>}
            {run.best5k && <Pill color="#ff3b5c">5 km {fmtDuration(run.best5k)}</Pill>}
            {run.best10k && <Pill color="#a78bfa">10 km {fmtDuration(run.best10k)}</Pill>}
          </div>
        )}

        {run.vmaResult && (
          <div className="mt-3 rounded-xl bg-amber/10 p-3 text-center text-amber ring-1 ring-amber/30">
            VMA mesurée : <b className="font-display text-2xl">{run.vmaResult} km/h</b>
          </div>
        )}
        {run.ghostDelta !== undefined && (
          <div className="mt-3 rounded-xl bg-ghost/10 p-3 text-sm ring-1 ring-ghost/30">
            👻 Contre « {run.ghostName} » : <b className={run.ghostDelta > 0 ? 'text-neon' : 'text-hot'}>{run.ghostDelta > 0 ? `gagné de ${run.ghostDelta} s` : `perdu de ${-run.ghostDelta} s`}</b>
          </div>
        )}

        <PaceChart run={run} />

        {run.splits.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/45">Temps au kilomètre</h3>
            {run.splits.map((s) => (
              <div key={s.km} className="flex items-center gap-3 py-1 text-sm">
                <div className="w-8 text-white/50">{s.km}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-white/5">
                  <div className="h-full rounded" style={{ width: `${40 + (60 * (slowest - s.ms)) / Math.max(1, slowest - fastest)}%`, background: s.ms === fastest ? '#ffb020' : '#7cfc6b88' }} />
                </div>
                <div className="w-14 text-right font-semibold tabular">{fmtPace(s.ms / 1000)}</div>
              </div>
            ))}
          </div>
        )}

        {run.stepLog && run.stepLog.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/45">Détail de la séance</h3>
            {run.stepLog.map((l, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-white/5 py-1.5 text-sm">
                <div className="h-6 w-1 rounded" style={{ background: STEP_COLORS[l.type] }} />
                <div className="flex-1 truncate">{l.label}</div>
                <div className="w-14 text-right text-white/60 tabular">{Math.round(l.distance)} m</div>
                <div className="w-14 text-right text-white/60 tabular">{fmtDuration(l.ms)}</div>
                <div className="w-14 text-right font-semibold tabular">{fmtPace(l.distance > 20 ? l.ms / l.distance : 0)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setPendingGhost(run.id)
              setTab('run')
            }}
            className="h-12 rounded-2xl bg-ghost font-semibold text-black"
          >
            👻 Courir contre
          </button>
          <button onClick={() => void shareGpx(run)} className="h-12 rounded-2xl bg-white/10 font-semibold">
            ⤴ Export GPX
          </button>
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Options">
        <label className="text-xs text-white/50">Nom</label>
        <div className="mt-1 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-xl bg-white/10 p-3 outline-none ring-1 ring-white/15" />
          <button
            onClick={async () => {
              await renameRun(run.id, name)
              setRun({ ...run, name })
              setMenu(false)
            }}
            className="rounded-xl bg-neon px-4 font-semibold text-black"
          >
            OK
          </button>
        </div>
        <button
          onClick={async () => {
            if (!confirm('Supprimer définitivement cette course ?')) return
            await deleteRun(run.id)
            setMenu(false)
            pop()
          }}
          className="mt-6 h-12 w-full rounded-2xl bg-hot/15 font-semibold text-hot"
        >
          Supprimer la course
        </button>
      </Sheet>
    </div>
  )
}

function S({ label, v, u }: { label: string; v: string; u?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] py-2 ring-1 ring-white/10">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className="font-display tabular text-2xl">
        {v}
        {u && <span className="ml-0.5 font-sans text-[10px] text-white/40">{u}</span>}
      </div>
    </div>
  )
}

/** Pace + elevation over distance */
function PaceChart({ run }: { run: Run }) {
  const W = 340,
    H = 140
  const data = useMemo(() => {
    const pts = run.points
    if (pts.length < 5) return null
    const total = pts[pts.length - 1].d
    const bins = Math.min(60, Math.max(10, Math.floor(total / 50)))
    const out: { d: number; v: number; alt: number | null }[] = []
    let j = 0
    for (let b = 0; b < bins; b++) {
      const d0 = (b / bins) * total,
        d1 = ((b + 1) / bins) * total
      while (j < pts.length - 1 && pts[j].d < d0) j++
      let k = j
      while (k < pts.length - 1 && pts[k].d < d1) k++
      const dd = pts[k].d - pts[j].d
      const da = pts[k].a - pts[j].a
      out.push({ d: (d0 + d1) / 2, v: da > 0 ? dd / (da / 1000) : 0, alt: pts[k].alt })
    }
    return { out, total }
  }, [run])
  if (!data) return null
  const vs = data.out.map((x) => x.v).filter((v) => v > 0.5)
  const vmax = Math.max(...vs) * 1.08
  const vmin = Math.min(...vs) * 0.92
  const alts = data.out.map((x) => x.alt).filter((a): a is number => a !== null)
  const amin = Math.min(...alts),
    amax = Math.max(...alts)
  const x = (d: number) => (d / data.total) * W
  const y = (v: number) => H - ((v - vmin) / Math.max(0.1, vmax - vmin)) * (H - 10) - 5
  const ya = (a: number) => H - ((a - amin) / Math.max(1, amax - amin)) * (H * 0.5)
  const line = data.out.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(Math.max(vmin, p.v)).toFixed(1)}`).join(' ')
  const area = alts.length > 3 ? `M0,${H} ` + data.out.map((p) => `L${x(p.d).toFixed(1)},${ya(p.alt ?? amin).toFixed(1)}`).join(' ') + ` L${W},${H} Z` : null
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-white/45">
        <span>Vitesse sur le parcours</span>
        <span className="font-normal normal-case tracking-normal text-white/35">
          {fmtPace(1000 / vmax)} ↔ {fmtPace(1000 / vmin)} /km
        </span>
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-white/[0.03] ring-1 ring-white/10">
        {area && <path d={area} fill="rgba(56,189,248,.12)" />}
        <path d={line} fill="none" stroke="#7cfc6b" strokeWidth="2" strokeLinejoin="round" />
        {run.splits.map((s) => (
          <line key={s.km} x1={x(s.km * 1000)} x2={x(s.km * 1000)} y1={0} y2={H} stroke="rgba(255,255,255,.08)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/35">
        <span>0</span>
        <span>haut = rapide{area && <span className="text-ice/60"> · ▬ altitude</span>}</span>
        <span>{fmtKm(data.total, 1)} km</span>
      </div>
    </div>
  )
}

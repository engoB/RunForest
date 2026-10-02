import { useMemo, useRef, useState } from 'react'
import { Bar, Header, Toggle } from '../components/ui'
import { exportAll, importAll, useRuns } from '../lib/storage'
import { setSettings, useSettings } from '../lib/settings'
import { ACHIEVEMENTS, levelFromXp, streakDays, totals, unlocked, weekKm, startOfWeek } from '../lib/game'
import { fmtDuration, fmtPace, msToKmh } from '../lib/geo'
import { push } from '../lib/nav'
import { speak, unlockAudio } from '../lib/voice'

export default function Profile() {
  const runs = useRuns()
  const s = useSettings()
  const tot = useMemo(() => totals(runs), [runs])
  const lvl = levelFromXp(tot.xp)
  const un = useMemo(() => unlocked(runs), [runs])
  const wk = weekKm(runs)
  const streak = streakDays(runs)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const records = useMemo(() => {
    const best = (k: 'best1k' | 'best5k' | 'best10k') => runs.reduce<number | undefined>((a, r) => (r[k] && (!a || r[k]! < a) ? r[k] : a), undefined)
    return {
      b1: best('best1k'),
      b5: best('best5k'),
      b10: best('best10k'),
      longest: runs.reduce((a, r) => Math.max(a, r.distance), 0),
      vmax: runs.reduce((a, r) => Math.max(a, r.maxSpeed), 0),
      climb: runs.reduce((a, r) => Math.max(a, r.elevGain), 0),
    }
  }, [runs])

  // last 8 weeks
  const weeks = useMemo(() => {
    const out: number[] = []
    const s0 = startOfWeek()
    for (let i = 7; i >= 0; i--) {
      const a = s0 - i * 7 * 86400000
      const b = a + 7 * 86400000
      out.push(runs.filter((r) => r.startedAt >= a && r.startedAt < b).reduce((x, r) => x + r.distance, 0) / 1000)
    }
    return out
  }, [runs])
  const wmax = Math.max(s.weeklyGoalKm, ...weeks)

  return (
    <div className="pb-28">
      <Header title="Profil" />
      <div className="px-4">
        {/* player card */}
        <div className="scan relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#14301c] to-[#0b1220] p-4 ring-1 ring-neon/30">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-black/40 ring-2 ring-neon/60">
              <div className="text-center">
                <div className="text-[9px] uppercase tracking-widest text-neon/70">Niv.</div>
                <div className="font-display text-4xl leading-none text-neon">{lvl.level}</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <input value={s.name} onChange={(e) => setSettings({ name: e.target.value })} className="w-full bg-transparent font-display text-3xl uppercase outline-none" />
              <div className="text-sm text-neon">{lvl.rank}</div>
              <div className="mt-2">
                <Bar value={lvl.progress} color="#7cfc6b" h={8} />
              </div>
              <div className="mt-1 text-[11px] text-white/45">
                {tot.xp} XP · encore {lvl.toNext} pour le niv. {lvl.level + 1}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <Mini v={tot.km < 100 ? tot.km.toFixed(1) : tot.km.toFixed(0)} l="km" />
            <Mini v={`${tot.runs}`} l="sorties" />
            <Mini v={`${Math.round(tot.ms / 3600000)}`} l="heures" />
            <Mini v={`${streak}🔥`} l="jours" />
          </div>
        </div>

        {/* weekly */}
        <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-white/45">Objectif de la semaine</div>
            <div className="flex items-center gap-1">
              <button onClick={() => setSettings({ weeklyGoalKm: Math.max(5, s.weeklyGoalKm - 5) })} className="h-7 w-7 rounded-full bg-white/10">
                −
              </button>
              <span className="w-14 text-center text-sm font-semibold">{s.weeklyGoalKm} km</span>
              <button onClick={() => setSettings({ weeklyGoalKm: s.weeklyGoalKm + 5 })} className="h-7 w-7 rounded-full bg-white/10">
                +
              </button>
            </div>
          </div>
          <div className="mt-2 font-display text-3xl">
            {wk.toFixed(1)} <span className="text-base text-white/40">/ {s.weeklyGoalKm} km</span>
            {wk >= s.weeklyGoalKm && <span className="ml-2 text-base text-neon">✔ objectif atteint</span>}
          </div>
          <Bar value={wk / s.weeklyGoalKm} color="#38bdf8" h={8} />
          <div className="mt-4 flex h-20 items-end gap-1.5">
            {weeks.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{ height: `${(v / wmax) * 64}px`, minHeight: 2, background: i === 7 ? '#38bdf8' : v >= s.weeklyGoalKm ? '#7cfc6b' : 'rgba(255,255,255,.2)' }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/30">
            <span>il y a 7 sem.</span>
            <span>cette semaine</span>
          </div>
        </div>

        {/* records */}
        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">Records</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Rec l="1 km" v={records.b1 ? fmtDuration(records.b1) : '—'} />
          <Rec l="5 km" v={records.b5 ? fmtDuration(records.b5) : '—'} />
          <Rec l="10 km" v={records.b10 ? fmtDuration(records.b10) : '—'} />
          <Rec l="Plus longue" v={`${(records.longest / 1000).toFixed(1)} km`} />
          <Rec l="Vitesse max" v={`${msToKmh(records.vmax).toFixed(1)}`} />
          <Rec l="Meilleure allure" v={isFinite(tot.bestPace) ? fmtPace(tot.bestPace) : '—'} />
        </div>

        {/* achievements */}
        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">
          Trophées {un.size}/{ACHIEVEMENTS.length}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const ok = un.has(a.id)
            return (
              <div key={a.id} className={`rounded-xl p-2 text-center ring-1 ${ok ? 'bg-amber/10 ring-amber/40' : 'bg-white/[0.03] ring-white/5'}`}>
                <div className={`text-3xl ${ok ? '' : 'opacity-25 grayscale'}`}>{a.icon}</div>
                <div className={`mt-1 text-[11px] font-semibold leading-tight ${ok ? 'text-amber' : 'text-white/40'}`}>{a.name}</div>
                <div className="text-[9px] leading-tight text-white/35">{a.desc}</div>
              </div>
            )
          })}
        </div>

        {/* settings */}
        <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">Réglages</h2>
        <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.04] px-4 ring-1 ring-white/10">
          <NumRow label="VMA" unit="km/h" value={s.vma ?? 0} step={0.5} onChange={(v) => setSettings({ vma: v || null })} />
          <NumRow label="Poids (calories)" unit="kg" value={s.weight} step={1} onChange={(v) => setSettings({ weight: v || 70 })} />
          <Toggle checked={s.voice} onChange={(v) => setSettings({ voice: v })} label="Coach vocal" desc="Annonces des étapes, kilomètres, fantôme" />
          <Toggle checked={s.announceKm} onChange={(v) => setSettings({ announceKm: v })} label="Annonce à chaque km" />
          <Toggle checked={s.ghostVoice} onChange={(v) => setSettings({ ghostVoice: v })} label="Annonces du fantôme" />
          <Toggle checked={s.beeps} onChange={(v) => setSettings({ beeps: v })} label="Bips (3-2-1, changements)" />
          <Toggle checked={s.autoPause} onChange={(v) => setSettings({ autoPause: v })} label="Pause automatique" desc="Le chrono s’arrête quand tu t’arrêtes (feux rouges)" />
          <Toggle checked={s.radarRotate} onChange={(v) => setSettings({ radarRotate: v })} label="Radar orienté dans ta direction" desc="Sinon : nord en haut" />
          <Toggle checked={s.demoGps} onChange={(v) => setSettings({ demoGps: v })} label="GPS de démo" desc="Simule un coureur pour tester l’appli chez toi" />
          <button
            onClick={() => {
              unlockAudio()
              speak('Test du coach vocal. Kilomètre 1, allure 5 minutes 30.', { force: true })
            }}
            className="w-full py-3 text-left text-sm font-medium text-ice"
          >
            🔊 Tester la voix
          </button>
        </div>

        <h2 className="mb-1 mt-6 text-xs font-bold uppercase tracking-widest text-white/45">Données</h2>
        <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.04] px-4 ring-1 ring-white/10">
          <button
            onClick={async () => {
              const json = await exportAll()
              const file = new File([json], `runforest-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
              if (navigator.canShare?.({ files: [file] })) {
                try {
                  await navigator.share({ files: [file] })
                  return
                } catch {
                  /* fallback */
                }
              }
              const a = document.createElement('a')
              a.href = URL.createObjectURL(file)
              a.download = file.name
              a.click()
            }}
            className="w-full py-3 text-left text-sm font-medium"
          >
            💾 Sauvegarder toutes mes données
          </button>
          <button onClick={() => fileRef.current?.click()} className="w-full py-3 text-left text-sm font-medium">
            📂 Restaurer une sauvegarde
          </button>
          <button onClick={() => push({ type: 'help' })} className="w-full py-3 text-left text-sm font-medium">
            ⓘ Écran éteint, GPS & iPhone
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const n = await importAll(await f.text())
              setMsg(`${n} courses restaurées.`)
            } catch (err) {
              setMsg((err as Error).message)
            }
          }}
        />
        {msg && <div className="mt-2 text-sm text-neon">{msg}</div>}
        <p className="mt-6 text-center text-[11px] text-white/30">
          RunForest · données stockées uniquement sur ton téléphone
          <br />
          Cartes © OpenStreetMap, © CARTO
        </p>
      </div>
    </div>
  )
}

const Mini = ({ v, l }: { v: string; l: string }) => (
  <div className="rounded-lg bg-black/30 py-1.5">
    <div className="font-display text-xl leading-none">{v}</div>
    <div className="text-[9px] uppercase tracking-widest text-white/45">{l}</div>
  </div>
)
const Rec = ({ v, l }: { v: string; l: string }) => (
  <div className="rounded-xl bg-white/[0.04] py-2 ring-1 ring-white/10">
    <div className="font-display text-xl">{v}</div>
    <div className="text-[9px] uppercase tracking-widest text-white/45">{l}</div>
  </div>
)

function NumRow({ label, unit, value, step, onChange }: { label: string; unit: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 text-sm font-medium">{label}</div>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        defaultValue={value || ''}
        placeholder="—"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-20 rounded-lg bg-white/10 px-2 py-1 text-right outline-none"
      />
      <span className="w-10 text-xs text-white/45">{unit}</span>
    </div>
  )
}

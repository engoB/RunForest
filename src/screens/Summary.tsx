import { useEffect, useMemo, useState } from 'react'
import type { Run } from '../lib/types'
import { useRuns } from '../lib/storage'
import { ACHIEVEMENTS, levelFromXp, totals, unlocked } from '../lib/game'
import { fmtDuration, fmtKm, fmtPace } from '../lib/geo'
import { setSettings, useSettings } from '../lib/settings'
import { fanfare } from '../lib/voice'
import RunMap from '../components/RunMap'

export interface Before {
  xp: number
  unlocked: Set<string>
}

export default function Summary({ run, before, onClose, onDetail }: { run: Run; before: Before; onClose: () => void; onDetail: () => void }) {
  const runs = useRuns()
  const settings = useSettings()
  const [vmaSaved, setVmaSaved] = useState(false)
  useEffect(() => fanfare(), [])
  const tot = useMemo(() => totals(runs), [runs])
  const lb = levelFromXp(before.xp)
  const la = levelFromXp(tot.xp)
  const newBadges = useMemo(() => {
    const u = unlocked(runs)
    return ACHIEVEMENTS.filter((a) => u.has(a.id) && !before.unlocked.has(a.id))
  }, [runs, before])
  const pace = run.distance > 0 ? run.activeMs / 1000 / (run.distance / 1000) : 0

  return (
    <div className="fixed inset-0 z-[1800] overflow-y-auto bg-ink">
      <div className="pt-safe pb-safe px-5">
        <div className="pop mt-8 text-center">
          <div className="hud-stroke font-display text-5xl uppercase leading-none text-amber drop-shadow-[0_4px_0_#000]">Mission accomplie</div>
          <div className="mt-2 font-display text-2xl uppercase tracking-wider text-white">Respect +{run.xp}</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <RunMap points={run.points} colorByPace className="h-48 w-full" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Big label="Distance" value={fmtKm(run.distance)} unit="km" />
          <Big label="Temps" value={fmtDuration(run.activeMs)} />
          <Big label="Allure" value={fmtPace(pace)} unit="/km" />
        </div>

        {run.ghostDelta !== undefined && (
          <div className={`mt-3 rounded-2xl p-3 text-center ring-1 ${run.ghostDelta > 0 ? 'bg-neon/10 ring-neon/40' : 'bg-ghost/10 ring-ghost/40'}`}>
            <div className="text-3xl">{run.ghostDelta > 0 ? '🏆' : '👻'}</div>
            <div className="font-display text-2xl uppercase">{run.ghostDelta > 0 ? 'Fantôme battu !' : 'Le fantôme gagne'}</div>
            <div className="text-sm text-white/60">
              {run.ghostDelta > 0 ? `${run.ghostDelta} s d’avance` : `${-run.ghostDelta} s de retard`} sur la distance commune
            </div>
          </div>
        )}

        {run.vmaResult && (
          <div className="mt-3 rounded-2xl bg-amber/10 p-4 text-center ring-1 ring-amber/40">
            <div className="text-xs uppercase tracking-widest text-amber">Résultat du test</div>
            <div className="font-display text-5xl text-amber">{run.vmaResult} km/h</div>
            <div className="text-xs text-white/50">VMA estimée (demi-Cooper). Actuelle : {settings.vma ?? '—'} km/h</div>
            <button
              disabled={vmaSaved}
              onClick={() => {
                setSettings({ vma: run.vmaResult! })
                setVmaSaved(true)
              }}
              className="mt-3 rounded-full bg-amber px-5 py-2 font-semibold text-black disabled:opacity-50"
            >
              {vmaSaved ? '✔ VMA enregistrée' : 'Utiliser comme ma VMA'}
            </button>
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Niveau</div>
              <div className="font-display text-3xl">
                {la.level} <span className="font-sans text-sm text-white/60">{la.rank}</span>
              </div>
            </div>
            {la.level > lb.level && <div className="pop rounded-full bg-neon px-3 py-1 font-display text-lg text-black">LEVEL UP!</div>}
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-neon to-ice transition-all duration-1000" style={{ width: `${la.progress * 100}%` }} />
          </div>
          <div className="mt-1 text-right text-[11px] text-white/40">{la.toNext} XP avant le niveau {la.level + 1}</div>
        </div>

        {newBadges.length > 0 && (
          <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <div className="mb-2 text-xs uppercase tracking-widest text-white/45">Nouveaux trophées</div>
            {newBadges.map((b) => (
              <div key={b.id} className="pop flex items-center gap-3 py-1.5">
                <div className="text-3xl">{b.icon}</div>
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-white/50">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 pb-6">
          <button onClick={onDetail} className="h-14 rounded-2xl bg-white/10 font-semibold">
            Voir le détail
          </button>
          <button onClick={onClose} className="h-14 rounded-2xl bg-neon font-display text-xl uppercase text-black">
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] py-2 ring-1 ring-white/10">
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</div>
      <div className="font-display tabular text-3xl">
        {value}
        {unit && <span className="ml-0.5 font-sans text-[10px] text-white/40">{unit}</span>}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import RunSetup from './screens/RunSetup'
import RunHud from './screens/RunHud'
import Summary, { type Before } from './screens/Summary'
import Intervals, { Builder, WorkoutDetail } from './screens/Intervals'
import Guide, { BackgroundHelp } from './screens/Guide'
import History, { RunDetail } from './screens/History'
import Profile from './screens/Profile'
import { restoreSession, useLive } from './lib/tracker'
import { loadGhost, push, setTab, useNav, type Tab } from './lib/nav'
import { loadIndex, requestPersistence } from './lib/storage'
import { totals, unlocked } from './lib/game'
import type { Run } from './lib/types'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'run', label: 'Courir', icon: 'M13 4a2 2 0 1 0 0-.01M9.5 21l2-6 2.5 2.5V21M7 12.5l2.5-4.5 4 1 2.5 3.5 2.5 1M9.5 8L6 9.5 5 13' },
  { id: 'intervals', label: 'Fractionné', icon: 'M3 17h3V9h3v8h3V5h3v12h3v-6h3' },
  { id: 'history', label: 'Historique', icon: 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  { id: 'profile', label: 'Profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
]

export default function App() {
  const live = useLive()
  const nav = useNav()
  const [summary, setSummary] = useState<{ run: Run; before: Before } | null>(null)
  const before = useRef<Before>({ xp: 0, unlocked: new Set() })
  const active = live.status !== 'idle'

  useEffect(() => {
    void restoreSession(loadGhost)
    void requestPersistence()
  }, [])

  // snapshot progression at run start, to show what changed at the end
  useEffect(() => {
    if (active)
      void loadIndex().then((runs) => {
        before.current = { xp: totals(runs).xp, unlocked: unlocked(runs) }
      })
  }, [active])

  const top = nav.stack[nav.stack.length - 1]

  return (
    <div className="mx-auto h-full max-w-md">
      {active ? (
        <RunHud onFinished={(run) => run && setSummary({ run, before: before.current })} />
      ) : (
        <div className="h-full overflow-y-auto no-scrollbar">
          {nav.tab === 'run' && <RunSetup />}
          {nav.tab === 'intervals' && <Intervals />}
          {nav.tab === 'history' && <History />}
          {nav.tab === 'profile' && <Profile />}
        </div>
      )}

      {!active && top && (
        <div key={nav.stack.length} className="fade-in fixed inset-0 z-[900] mx-auto max-w-md overflow-y-auto bg-ink no-scrollbar">
          {top.type === 'run-detail' && <RunDetail id={top.id} />}
          {top.type === 'workout' && <WorkoutDetail w={top.workout} />}
          {top.type === 'builder' && <Builder edit={top.workout} />}
          {top.type === 'guide' && <Guide />}
          {top.type === 'help' && <BackgroundHelp />}
        </div>
      )}

      {!active && !top && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-[800] mx-auto max-w-md border-t border-white/10 bg-ink/95 backdrop-blur">
          <div className="grid grid-cols-4">
            {TABS.map((t) => {
              const on = nav.tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 pt-2 ${on ? 'text-neon' : 'text-white/45'}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={t.icon} />
                  </svg>
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {summary && (
        <Summary
          run={summary.run}
          before={summary.before}
          onClose={() => {
            setSummary(null)
            setTab('run')
          }}
          onDetail={() => {
            const id = summary.run.id
            setSummary(null)
            setTab('history')
            push({ type: 'run-detail', id })
          }}
        />
      )}
    </div>
  )
}

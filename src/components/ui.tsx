import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Stat({ label, value, unit, big, color, className = '' }: { label: string; value: ReactNode; unit?: string; big?: boolean; color?: string; className?: string }) {
  return (
    <div className={`rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/5 ${className}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/45">{label}</div>
      <div className={`font-display tabular leading-none ${big ? 'text-4xl' : 'text-2xl'} mt-1`} style={{ color }}>
        {value}
        {unit && <span className="ml-1 font-sans text-xs font-medium text-white/40">{unit}</span>}
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="pb-safe max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-panel p-5 ring-1 ring-white/10 slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
        {title && <h3 className="mb-3 font-display text-2xl uppercase tracking-wide">{title}</h3>}
        {children}
      </div>
    </div>
  )
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="pt-safe sticky top-0 z-20 flex items-center gap-2 bg-ink/90 px-4 pb-3 backdrop-blur">
      {onBack && (
        <button onClick={onBack} className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-2xl active:bg-white/10" aria-label="Retour">
          ‹
        </button>
      )}
      <h1 className="flex-1 truncate font-display text-3xl uppercase tracking-wide">{title}</h1>
      {right}
    </div>
  )
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-3 text-left">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-white/45">{desc}</div>}
      </div>
      <div className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-neon' : 'bg-white/15'}`}>
        <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </div>
    </button>
  )
}

/** Press and hold to confirm */
export function HoldButton({ onDone, ms = 1200, children, className = '', color = '#ff3b5c' }: { onDone: () => void; ms?: number; children: ReactNode; className?: string; color?: string }) {
  const [p, setP] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    setP(0)
  }
  const loop = () => {
    const v = Math.min(1, (performance.now() - start.current) / ms)
    setP(v)
    if (v >= 1) {
      stop()
      navigator.vibrate?.(60)
      onDone()
      return
    }
    raf.current = requestAnimationFrame(loop)
  }
  useEffect(() => stop, [])
  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onPointerDown={() => {
        start.current = performance.now()
        raf.current = requestAnimationFrame(loop)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="absolute inset-y-0 left-0 opacity-40" style={{ width: `${p * 100}%`, background: color }} />
      <span className="relative">{children}</span>
    </button>
  )
}

export function Bar({ value, color, bg = 'rgba(255,255,255,.12)', h = 6 }: { value: number; color: string; bg?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-sm" style={{ background: bg, height: h }}>
      <div className="h-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

export function Stars({ n, max = 5, size = 18 }: { n: number; max?: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i < n ? 'drop-shadow-[0_0_6px_rgba(255,255,255,.7)]' : ''}>
          <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6z" fill={i < n ? '#fff' : 'rgba(255,255,255,.12)'} stroke="#000" strokeWidth="1" />
        </svg>
      ))}
    </div>
  )
}

export function Pill({ children, color = '#7cfc6b' }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${color}22`, color }}>
      {children}
    </span>
  )
}

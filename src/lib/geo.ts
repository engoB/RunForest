export type LatLng = [number, number]

const R = 6371000
const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a[0])
  const φ2 = toRad(b[0])
  const Δλ = toRad(b[1] - a[1])
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function destination(p: LatLng, distM: number, brgDeg: number): LatLng {
  const δ = distM / R
  const θ = toRad(brgDeg)
  const φ1 = toRad(p[0])
  const λ1 = toRad(p[1])
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return [toDeg(φ2), toDeg(λ2)]
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/* ---------- formatting ---------- */

export function fmtDuration(ms: number, forceHours = false): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 || forceHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** pace in seconds per km */
export function fmtPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || !isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return "--'--"
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  if (s === 60) return `${m + 1}'00`
  return `${m}'${String(s).padStart(2, '0')}`
}

export function fmtKm(m: number, digits = 2): string {
  return (m / 1000).toFixed(digits)
}

export const msToKmh = (ms: number) => ms * 3.6
export const kmhToPace = (kmh: number) => (kmh > 0 ? 3600 / kmh : 0)
export const speedToPace = (ms: number) => (ms > 0.3 ? 1000 / ms : 0)

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** spoken pace e.g. "5 minutes 12" */
export function spokenPace(secPerKm: number): string {
  if (!secPerKm || !isFinite(secPerKm)) return ''
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return s ? `${m} minutes ${s}` : `${m} minutes`
}
export function spokenDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (h) parts.push(`${h} heure${h > 1 ? 's' : ''}`)
  if (m) parts.push(`${m} minute${m > 1 ? 's' : ''}`)
  if (s && !h) parts.push(`${s} seconde${s > 1 ? 's' : ''}`)
  return parts.join(' ') || '0 seconde'
}
export function spokenDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} mètres`
  const km = m / 1000
  return Number.isInteger(km) ? `${km} kilomètre${km > 1 ? 's' : ''}` : `${km.toFixed(1).replace('.', ' virgule ')} kilomètres`
}

import type { TrackPoint } from './types'

function search(points: TrackPoint[], key: 'a' | 'd', v: number): number {
  // index of last point with p[key] <= v
  let lo = 0,
    hi = points.length - 1
  if (v <= points[0][key]) return 0
  if (v >= points[hi][key]) return hi
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid][key] <= v) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Ghost position + distance at a given active time */
export function ghostAt(points: TrackPoint[], activeMs: number): { lat: number; lng: number; d: number; finished: boolean } | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  if (activeMs >= last.a) return { lat: last.lat, lng: last.lng, d: last.d, finished: true }
  const i = search(points, 'a', activeMs)
  const p = points[i]
  const q = points[Math.min(i + 1, points.length - 1)]
  const f = q.a === p.a ? 0 : (activeMs - p.a) / (q.a - p.a)
  return { lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f, d: p.d + (q.d - p.d) * f, finished: false }
}

/** Active time at which the ghost reached distance d (extrapolated past the end at its average speed) */
export function ghostTimeAtDist(points: TrackPoint[], d: number): number {
  const last = points[points.length - 1]
  if (d >= last.d) {
    const avg = last.d / Math.max(1, last.a) // m/ms
    return last.a + (d - last.d) / Math.max(avg, 1e-6)
  }
  const i = search(points, 'd', d)
  const p = points[i]
  const q = points[Math.min(i + 1, points.length - 1)]
  const f = q.d === p.d ? 0 : (d - p.d) / (q.d - p.d)
  return p.a + (q.a - p.a) * f
}

export interface GhostDelta {
  meters: number // + ahead
  seconds: number // + ahead
  lat: number
  lng: number
  finished: boolean
}

export function ghostDelta(points: TrackPoint[], myActiveMs: number, myDist: number): GhostDelta | null {
  const g = ghostAt(points, myActiveMs)
  if (!g) return null
  const tg = ghostTimeAtDist(points, myDist)
  return { meters: myDist - g.d, seconds: (tg - myActiveMs) / 1000, lat: g.lat, lng: g.lng, finished: g.finished }
}

import { haversine } from './geo'
import type { Run, TrackPoint } from './types'
import { bestEffort, calories, computeXp } from './game'
import { getSettings } from './settings'

export function toGpx(run: Run): string {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
  const segs: TrackPoint[][] = []
  for (const p of run.points) {
    if (!segs.length || p.b) segs.push([])
    segs[segs.length - 1].push(p)
  }
  const body = segs
    .map(
      (seg) =>
        `    <trkseg>\n${seg
          .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${p.alt !== null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time></trkpt>`)
          .join('\n')}\n    </trkseg>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunForest" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(run.name)}</name><time>${new Date(run.startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${esc(run.name)}</name>
    <type>running</type>
${body}
  </trk>
</gpx>`
}

export async function shareGpx(run: Run) {
  const gpx = toGpx(run)
  const name = `${run.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'course'}_${new Date(run.startedAt).toISOString().slice(0, 10)}.gpx`
  const file = new File([gpx], name, { type: 'application/gpx+xml' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: run.name })
      return
    } catch {
      /* cancelled → fallback */
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Parse a GPX (Strava, Garmin, etc.) into a Run usable as a ghost */
export function fromGpx(xml: string, fallbackName = 'Parcours importé'): Run {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const pts = Array.from(doc.getElementsByTagName('trkpt'))
  const rtepts = pts.length ? pts : Array.from(doc.getElementsByTagName('rtept'))
  if (rtepts.length < 2) throw new Error('Aucun point trouvé dans ce GPX')
  const name = doc.querySelector('trk > name, metadata > name')?.textContent?.trim() || fallbackName
  const points: TrackPoint[] = []
  let d = 0
  let t0: number | null = null
  const hasTime = !!rtepts[0].getElementsByTagName('time')[0]
  const assumedSpeed = 2.9 // m/s if no timestamps (≈ 5'45/km)
  for (const el of rtepts) {
    const lat = parseFloat(el.getAttribute('lat') || '')
    const lng = parseFloat(el.getAttribute('lon') || '')
    if (isNaN(lat) || isNaN(lng)) continue
    const ele = el.getElementsByTagName('ele')[0]?.textContent
    const timeTxt = el.getElementsByTagName('time')[0]?.textContent
    const prev = points[points.length - 1]
    if (prev) d += haversine([prev.lat, prev.lng], [lat, lng])
    let t: number
    if (hasTime && timeTxt) {
      t = Date.parse(timeTxt)
      if (t0 === null) t0 = t
    } else {
      if (t0 === null) t0 = Date.now()
      t = t0 + (d / assumedSpeed) * 1000
    }
    points.push({ lat, lng, t, alt: ele ? parseFloat(ele) : null, acc: 5, d, a: t - (t0 ?? t) })
  }
  let elev = 0
  for (let i = 1; i < points.length; i++) {
    const dA = (points[i].alt ?? 0) - (points[i - 1].alt ?? 0)
    if (dA > 0 && points[i].alt !== null && points[i - 1].alt !== null) elev += dA
  }
  const last = points[points.length - 1]
  const run: Run = {
    id: `i${Date.now()}`,
    name,
    kind: 'imported',
    startedAt: points[0].t,
    endedAt: last.t,
    distance: Math.round(last.d),
    activeMs: last.a,
    elapsedMs: last.a,
    maxSpeed: 0,
    elevGain: Math.round(elev * 0.7),
    calories: calories(last.d, getSettings().weight),
    xp: 0,
    gaps: 0,
    points,
    splits: [],
  }
  // splits
  let prevAt = 0
  for (let k = 1; k * 1000 <= last.d; k++) {
    const i = points.findIndex((p) => p.d >= k * 1000)
    const p = points[i - 1],
      q = points[i]
    const f = (k * 1000 - p.d) / Math.max(1e-6, q.d - p.d)
    const at = p.a + f * (q.a - p.a)
    run.splits.push({ km: k, ms: at - prevAt, at })
    prevAt = at
  }
  run.best1k = bestEffort(points, 1000)
  run.best5k = bestEffort(points, 5000)
  run.best10k = bestEffort(points, 10000)
  run.xp = Math.round(computeXp({ ...run }) / 2)
  return run
}

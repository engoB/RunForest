import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '../lib/types'
import { TILE_ATTR, TILE_URL } from './Radar'

interface Props {
  points: TrackPoint[]
  ghostRoute?: TrackPoint[] | null
  ghost?: { lat: number; lng: number } | null
  pos?: { lat: number; lng: number } | null
  colorByPace?: boolean
  follow?: boolean
  className?: string
  markers?: { lat: number; lng: number; label: string }[]
}

export function paceColor(f: number) {
  // f: 0 slow → 1 fast
  const stops = [
    [0, [56, 189, 248]],
    [0.5, [124, 252, 107]],
    [0.75, [255, 176, 32]],
    [1, [255, 59, 92]],
  ] as const
  f = Math.max(0, Math.min(1, f))
  for (let i = 1; i < stops.length; i++) {
    if (f <= stops[i][0]) {
      const [a, ca] = stops[i - 1]
      const [b, cb] = stops[i]
      const t = (f - a) / (b - a)
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t))
      return `rgb(${c.join(',')})`
    }
  }
  return 'rgb(255,59,92)'
}

export default function RunMap({ points, ghostRoute, ghost, pos, colorByPace, follow, className = '', markers }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const dyn = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([48.8566, 2.3522], 15)
    L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 20, attribution: TILE_ATTR, detectRetina: true }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    dyn.current = L.layerGroup().addTo(m)
    map.current = m
    setTimeout(() => m.invalidateSize(), 50)
    return () => {
      m.remove()
      map.current = null
      fitted.current = false
    }
  }, [])

  useEffect(() => {
    const m = map.current
    const lg = layer.current
    if (!m || !lg) return
    lg.clearLayers()
    if (ghostRoute?.length) L.polyline(ghostRoute.map((p) => [p.lat, p.lng] as [number, number]), { color: '#a78bfa', weight: 4, opacity: 0.5, dashArray: '6 8' }).addTo(lg)
    // split into segments (manual pauses break the line)
    const segs: TrackPoint[][] = []
    for (const p of points) {
      if (!segs.length || p.b) segs.push([])
      segs[segs.length - 1].push(p)
    }
    if (colorByPace && points.length > 2) {
      const speeds: number[] = []
      for (let i = 1; i < points.length; i++) {
        const dt = points[i].a - points[i - 1].a
        speeds.push(dt > 0 ? (points[i].d - points[i - 1].d) / (dt / 1000) : 0)
      }
      const sorted = speeds.filter((v) => v > 0.5).sort((a, b) => a - b)
      const lo = sorted[Math.floor(sorted.length * 0.1)] ?? 0
      const hi = sorted[Math.floor(sorted.length * 0.9)] ?? 1
      const chunk = 4
      for (let i = 1; i < points.length; i += chunk) {
        const slice = points.slice(i - 1, Math.min(points.length, i + chunk))
        if (slice.some((p, k) => k > 0 && p.b)) continue
        const sp = speeds.slice(i - 1, i - 1 + chunk)
        const avg = sp.reduce((a, b) => a + b, 0) / Math.max(1, sp.length)
        const gap = slice.some((p) => p.g)
        L.polyline(slice.map((p) => [p.lat, p.lng] as [number, number]), {
          color: gap ? '#888' : paceColor((avg - lo) / Math.max(0.1, hi - lo)),
          weight: 5,
          dashArray: gap ? '2 8' : undefined,
          lineCap: 'round',
        }).addTo(lg)
      }
    } else {
      for (const s of segs) L.polyline(s.map((p) => [p.lat, p.lng] as [number, number]), { color: '#ffb020', weight: 5, lineCap: 'round' }).addTo(lg)
    }
    if (points.length) {
      L.circleMarker([points[0].lat, points[0].lng], { radius: 7, color: '#000', weight: 2, fillColor: '#7cfc6b', fillOpacity: 1 }).bindTooltip('Départ').addTo(lg)
      const last = points[points.length - 1]
      if (!follow) L.circleMarker([last.lat, last.lng], { radius: 7, color: '#000', weight: 2, fillColor: '#ff3b5c', fillOpacity: 1 }).bindTooltip('Arrivée').addTo(lg)
    }
    markers?.forEach((mk) =>
      L.marker([mk.lat, mk.lng], {
        icon: L.divIcon({ className: '', html: `<div style="background:#000;color:#ffb020;border:1px solid #ffb020;border-radius:6px;padding:0 4px;font:700 10px Inter;white-space:nowrap;transform:translate(-50%,-50%)">${mk.label}</div>`, iconSize: [0, 0] }),
      }).addTo(lg),
    )
    if (!fitted.current) {
      const all = [...points, ...(ghostRoute ?? [])]
      if (all.length > 1) {
        m.fitBounds(L.latLngBounds(all.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30] })
        fitted.current = true
      } else if (pos) m.setView([pos.lat, pos.lng], 16)
    }
  }, [points, points.length, ghostRoute, colorByPace, follow, markers, pos])

  useEffect(() => {
    const d = dyn.current
    if (!d) return
    d.clearLayers()
    if (ghost) L.circleMarker([ghost.lat, ghost.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#a78bfa', fillOpacity: 1 }).bindTooltip('👻').addTo(d)
    if (pos) L.circleMarker([pos.lat, pos.lng], { radius: 8, color: '#000', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(d)
    if (follow && pos && map.current) map.current.panTo([pos.lat, pos.lng], { animate: true })
  }, [ghost?.lat, ghost?.lng, pos?.lat, pos?.lng, follow, ghost, pos])

  return <div ref={el} className={className} />
}

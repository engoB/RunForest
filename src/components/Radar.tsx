import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '../lib/types'

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
export const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO'

interface Props {
  size: number
  pos: { lat: number; lng: number; acc: number } | null
  heading: number | null
  rotate: boolean
  points: TrackPoint[]
  ghost?: { lat: number; lng: number } | null
  ghostRoute?: TrackPoint[] | null
  zoom?: number
  onClick?: () => void
  bars?: { value: number; color: string }[]
}

export default function Radar({ size, pos, heading, rotate, points, ghost, ghostRoute, zoom = 16.3, onClick, bars }: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const track = useRef<L.Polyline | null>(null)
  const ghostMk = useRef<L.CircleMarker | null>(null)
  const ghostLine = useRef<L.Polyline | null>(null)
  const startMk = useRef<L.CircleMarker | null>(null)
  const drawn = useRef(0)
  const arr = useRef<TrackPoint[] | null>(null)
  const inner = Math.ceil(size * 1.45)

  useEffect(() => {
    if (!innerRef.current) return
    const m = L.map(innerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomSnap: 0,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
    }).setView(pos ? [pos.lat, pos.lng] : [48.8566, 2.3522], zoom)
    L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 20, detectRetina: true }).addTo(m)
    ghostLine.current = L.polyline([], { color: '#a78bfa', weight: 3, opacity: 0.45, dashArray: '4 6' }).addTo(m)
    track.current = L.polyline([], { color: '#ffb020', weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(m)
    startMk.current = L.circleMarker([0, 0], { radius: 5, color: '#000', weight: 2, fillColor: '#7cfc6b', fillOpacity: 1 })
    ghostMk.current = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: '#a78bfa', fillOpacity: 1 })
    map.current = m
    return () => {
      m.remove()
      map.current = null
      drawn.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // track
  useEffect(() => {
    const t = track.current
    const m = map.current
    if (!t || !m) return
    if (points.length < drawn.current || arr.current !== points) {
      arr.current = points
      t.setLatLngs([])
      drawn.current = 0
    }
    for (let i = drawn.current; i < points.length; i++) t.addLatLng([points[i].lat, points[i].lng])
    drawn.current = points.length
    if (points.length) {
      startMk.current!.setLatLng([points[0].lat, points[0].lng])
      if (!m.hasLayer(startMk.current!)) startMk.current!.addTo(m)
    } else startMk.current?.remove()
  }, [points, points.length])

  useEffect(() => {
    ghostLine.current?.setLatLngs(ghostRoute ? ghostRoute.map((p) => [p.lat, p.lng] as [number, number]) : [])
  }, [ghostRoute])

  useEffect(() => {
    const m = map.current
    if (!m || !ghostMk.current) return
    if (ghost) {
      ghostMk.current.setLatLng([ghost.lat, ghost.lng])
      if (!m.hasLayer(ghostMk.current)) ghostMk.current.addTo(m)
    } else ghostMk.current.remove()
  }, [ghost?.lat, ghost?.lng, ghost])

  useEffect(() => {
    if (pos && map.current) map.current.setView([pos.lat, pos.lng], zoom, { animate: false })
  }, [pos?.lat, pos?.lng, zoom, pos])

  const h = heading ?? 0
  const mapRot = rotate ? -h : 0
  const arrowRot = rotate ? 0 : h

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: size }}>
      <div
        onClick={onClick}
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size, boxShadow: '0 0 0 3px #000, 0 0 0 5px rgba(255,255,255,.18), 0 10px 30px rgba(0,0,0,.6)' }}
      >
        <div
          className="absolute"
          style={{
            width: inner,
            height: inner,
            left: (size - inner) / 2,
            top: (size - inner) / 2,
            transform: `rotate(${mapRot}deg)`,
            transition: 'transform .8s ease-out',
            filter: 'saturate(1.3) hue-rotate(-12deg) brightness(1.15)',
          }}
        >
          <div ref={innerRef} className="h-full w-full" />
        </div>
        {/* tint + sweep */}
        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
        <div className="radar-sweep pointer-events-none absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, rgba(124,252,107,.18), transparent 22%)' }} />
        {/* accuracy halo */}
        {pos && pos.acc > 15 && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/15 ring-1 ring-sky-300/30" style={{ width: Math.min(size, pos.acc * 1.6), height: Math.min(size, pos.acc * 1.6) }} />}
        {/* player arrow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${arrowRot}deg)`, transition: 'transform .6s' }}>
          <svg width="22" height="26" viewBox="0 0 22 26">
            <path d="M11 1 L21 24 L11 18 L1 24 Z" fill={pos ? '#fff' : '#666'} stroke="#000" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        {/* north marker */}
        <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${mapRot}deg)`, transition: 'transform .8s ease-out' }}>
          <div className="absolute left-1/2 top-1 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-black text-[10px] font-black text-white ring-1 ring-white/40" style={{ transform: `translateX(-50%) rotate(${-mapRot}deg)` }}>
            N
          </div>
        </div>
        {!pos && <div className="absolute inset-0 grid place-items-center bg-black/50 text-center text-[11px] font-semibold uppercase tracking-widest text-white/70">Recherche
          <br />GPS…</div>}
      </div>
      {bars && (
        <div className="flex w-[86%] gap-1">
          {bars.map((b, i) => (
            <div key={i} className="h-2 flex-1 overflow-hidden bg-black/80 ring-1 ring-black" style={{ background: `${b.color}40` }}>
              <div className="h-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, b.value)) * 100}%`, background: b.color }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

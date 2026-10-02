import { destination, type LatLng } from './geo'

export interface Fix {
  lat: number
  lng: number
  acc: number
  alt: number | null
  altAcc: number | null
  speed: number | null
  heading: number | null
  t: number
}

export interface GeoSource {
  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void
  stop(): void
}

export class RealGps implements GeoSource {
  private id: number | null = null
  start(onFix: (f: Fix) => void, onError: (msg: string) => void) {
    if (!('geolocation' in navigator)) {
      onError('GPS non disponible sur cet appareil')
      return
    }
    this.stop()
    this.id = navigator.geolocation.watchPosition(
      (p) =>
        onFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: p.coords.accuracy,
          alt: p.coords.altitude,
          altAcc: p.coords.altitudeAccuracy,
          speed: p.coords.speed,
          heading: p.coords.heading,
          t: Date.now(),
        }),
      (e) => onError(e.code === 1 ? 'Accès à la localisation refusé. Autorise-la dans Réglages › Confidentialité › Service de localisation › Safari / RunForest.' : e.message || 'Erreur GPS'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
  }
  stop() {
    if (this.id !== null) navigator.geolocation.clearWatch(this.id)
    this.id = null
  }
}

/** Simulated runner for testing the app at home. Runs a loop around a center point. */
export class DemoGps implements GeoSource {
  private timer: number | null = null
  private dist = 0
  private last = Date.now()
  private path: LatLng[] = []
  private cum: number[] = []
  center: LatLng
  desiredSpeed: () => number

  constructor(center: LatLng, desiredSpeed: () => number) {
    this.center = center
    this.desiredSpeed = desiredSpeed
    this.buildPath()
    const saved = Number(sessionStorage.getItem('rf-demo-dist') || 0)
    this.dist = saved
  }
  private buildPath() {
    const pts: LatLng[] = []
    const n = 90
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * 360
      const r = 380 + 90 * Math.sin((th * Math.PI) / 60) + 50 * Math.cos((th * Math.PI) / 25)
      pts.push(destination(this.center, r, th))
    }
    this.path = pts
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i]
      const dy = (b[0] - a[0]) * 111320
      const dx = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dy))
    }
  }
  private posAt(d: number): LatLng {
    const L = this.cum[this.cum.length - 1]
    const x = ((d % L) + L) % L
    let i = 1
    while (i < this.cum.length && this.cum[i] < x) i++
    const a = this.path[i - 1],
      b = this.path[Math.min(i, this.path.length - 1)]
    const f = (x - this.cum[i - 1]) / Math.max(1e-6, this.cum[i] - this.cum[i - 1])
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
  start(onFix: (f: Fix) => void) {
    this.stop()
    this.last = Date.now()
    const tick = () => {
      const now = Date.now()
      const dt = (now - this.last) / 1000
      this.last = now
      const factor = Number(localStorage.getItem('rf-demo-x') || 1)
      const v = this.desiredSpeed() * (0.94 + Math.random() * 0.12) * factor
      this.dist += v * dt
      sessionStorage.setItem('rf-demo-dist', String(this.dist))
      const p = this.posAt(this.dist)
      const jitter = () => (Math.random() - 0.5) * 0.00002
      onFix({ lat: p[0] + jitter(), lng: p[1] + jitter(), acc: 5 + Math.random() * 4, alt: 60 + 8 * Math.sin(this.dist / 300), altAcc: 4, speed: v, heading: null, t: now })
    }
    tick()
    this.timer = window.setInterval(tick, 1000)
  }
  stop() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}

export const DEFAULT_CENTER: LatLng = [48.8809, 2.3822] // Buttes-Chaumont, Paris

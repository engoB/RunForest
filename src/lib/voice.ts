import { getSettings } from './settings'

let ctx: AudioContext | null = null
let frVoice: SpeechSynthesisVoice | null = null

function pickVoice() {
  if (!('speechSynthesis' in window)) return
  const voices = speechSynthesis.getVoices()
  frVoice =
    voices.find((v) => v.lang === 'fr-FR' && /Thomas|Amélie|Audrey|Google/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith('fr')) ||
    null
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.onvoiceschanged = pickVoice
}

/** Must be called from a user gesture (iOS unlocks audio + speech only then). */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    // silent blip to unlock
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    g.gain.value = 0.0001
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.02)
  } catch {
    /* ignore */
  }
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    }
  } catch {
    /* ignore */
  }
}

export function speak(text: string, opts: { force?: boolean; interrupt?: boolean } = {}) {
  if (!opts.force && !getSettings().voice) return
  if (!('speechSynthesis' in window)) return
  try {
    if (opts.interrupt) speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'fr-FR'
    if (frVoice) u.voice = frVoice
    u.rate = 1.05
    u.pitch = 1
    speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

export function beep(freq = 880, duration = 0.15, volume = 0.35) {
  if (!getSettings().beeps) return
  try {
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = freq
    const t = ctx.currentTime
    g.gain.setValueAtTime(volume, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    o.connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + duration + 0.02)
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(80)
  } catch {
    /* ignore */
  }
}

export function startBeep() {
  beep(1320, 0.45, 0.4)
  try {
    navigator.vibrate?.([200, 80, 200])
  } catch {
    /* ignore */
  }
}

export function fanfare() {
  if (!ctx || !getSettings().beeps) return
  ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 0.3), i * 140))
}

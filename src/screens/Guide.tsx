import type { ReactNode } from 'react'
import { Header } from '../components/ui'
import { pop, push, setPendingWorkout, setTab } from '../lib/nav'
import { PRESETS } from '../lib/workouts'
import { useSettings } from '../lib/settings'
import { fmtPace, kmhToPace } from '../lib/geo'

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber font-display text-lg text-black">{n}</div>
        <h2 className="font-display text-2xl uppercase leading-tight">{title}</h2>
      </div>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-white/75">{children}</div>
    </section>
  )
}

const Tip = ({ children, color = '#7cfc6b' }: { children: ReactNode; color?: string }) => (
  <div className="rounded-xl p-3 text-sm" style={{ background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}44`, color }}>
    {children}
  </div>
)

export default function Guide() {
  const { vma } = useSettings()
  const ex = vma ?? 14
  const p = (pct: number) => fmtPace(kmhToPace((ex * pct) / 100))
  const launch = (id: string) => {
    const w = PRESETS.find((x) => x.id === id)!
    setPendingWorkout(w)
    setTab('run')
  }
  return (
    <div className="pb-20">
      <Header title="Guide du fractionné" onBack={pop} />
      <div className="px-4">
        <p className="text-white/70">
          Le fractionné, c’est alterner des <b className="text-hot">portions rapides</b> et des <b className="text-neon">récupérations</b>. C’est la méthode la plus efficace pour progresser en vitesse et en endurance… à condition de bien la doser.
        </p>

        <Section n="1" title="Pourquoi ça marche">
          <p>En coupant l’effort en morceaux, tu passes beaucoup plus de temps à haute intensité que si tu courais vite d’une traite. Ton cœur, tes poumons et tes muscles s’adaptent : ta vitesse max aérobie (VMA) monte, et toutes tes allures deviennent plus faciles.</p>
          <p>Résultat : en 6-8 semaines à raison d’une séance par semaine, la plupart des coureurs gagnent nettement sur 5 et 10 km.</p>
        </Section>

        <Section n="2" title="La VMA, ta boussole">
          <p>La <b>VMA</b> (vitesse maximale aérobie) est la vitesse à laquelle tu consommes le maximum d’oxygène. Tu peux la tenir environ 4 à 7 minutes. Toutes les séances s’expriment en <b>% de VMA</b>.</p>
          <p>
            <b>Mesure-la avec le test demi-Cooper</b> (intégré à l’appli) : 15 min d’échauffement, puis 6 minutes le plus loin possible à allure régulière. Distance en mètres ÷ 100 = ta VMA en km/h. Ex : 1 400 m → VMA 14 km/h.
          </p>
          <button onClick={() => launch('vma-test')} className="w-full rounded-xl bg-amber/15 p-3 text-left text-sm font-semibold text-amber ring-1 ring-amber/40">
            🧪 Lancer le test VMA →
          </button>
          <p className="text-sm text-white/50">Sur terrain plat, un jour où tu es reposé. Refais-le toutes les 6-8 semaines pour suivre tes progrès.</p>
        </Section>

        <Section n="3" title={`Tes allures ${vma ? '' : '(exemple VMA 14)'}`}>
          <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
            {[
              ['Footing / échauffement', '60-70%', `${p(70)} – ${p(60)}`, '#38bdf8'],
              ['Seuil (semi)', '85%', p(85), '#a78bfa'],
              ['VMA longue (3-5 min, 1000 m)', '90-95%', `${p(95)} – ${p(90)}`, '#ffb020'],
              ['VMA courte (30 s, 200-400 m)', '100-105%', `${p(105)} – ${p(100)}`, '#ff3b5c'],
            ].map(([a, b, c, col]) => (
              <div key={a} className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-3 py-2 text-sm last:border-0">
                <div className="h-6 w-1 rounded" style={{ background: col }} />
                <div className="flex-1">{a}</div>
                <div className="w-16 text-white/50">{b}</div>
                <div className="w-24 text-right font-semibold" style={{ color: col }}>
                  {c}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-white/50">Pas encore de VMA ? Fie-toi aux sensations : effort court = « je ne pourrais pas parler », effort long = « je pourrais dire 2-3 mots ».</p>
        </Section>

        <Section n="4" title="Structure d’une séance">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <b>Échauffement 15-20 min</b> en footing facile (tu peux parler). Ajoute 3-4 accélérations progressives de 15 s à la fin.
            </li>
            <li>
              <b>Le corps de séance</b> : les répétitions. Garde la <b>même allure</b> sur toutes : la dernière doit être aussi rapide que la première. Si tu craques, tu es parti trop vite.
            </li>
            <li>
              <b>Récupération active</b> : trottine (ou marche si besoin) entre les efforts. Récup ≈ durée de l’effort pour les efforts courts, moitié pour les longs.
            </li>
            <li>
              <b>Retour au calme 10 min</b> en trottinant très lentement, puis quelques étirements doux.
            </li>
          </ol>
        </Section>

        <Section n="5" title="Comment utiliser l’appli">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Règle ta VMA (onglet Fractionné → carte VMA) ou fais le test.</li>
            <li>Choisis une séance prête ou crée la tienne avec le constructeur.</li>
            <li>« Lancer cette séance » → GO. L’appli enchaîne les étapes toute seule.</li>
            <li>
              Le coach vocal annonce chaque étape avec ton allure cible, bipe 3-2-1 avant chaque changement et te dit <b className="text-hot">ACCÉLÈRE</b> / <b className="text-ice">TROP VITE</b> à l’écran.
            </li>
            <li>Mets des écouteurs, active le 🔒 mode poche et cours. Le bouton « Passer » saute une étape si besoin.</li>
          </ol>
          <Tip color="#ffb020">Le GPS a quelques secondes de retard et peut être imprécis en forêt ou entre des immeubles : pour les efforts très courts, préfère les séances au temps (30/30) plutôt qu’à la distance.</Tip>
        </Section>

        <Section n="6" title="Programme pour démarrer">
          <p>Si tu cours depuis au moins 1-2 mois régulièrement :</p>
          <div className="space-y-1.5">
            {[
              ['Semaines 1-2', '30/30 découverte (8 répétitions)', '30-30-debutant'],
              ['Semaines 3-4', 'Fartlek 1-2-3-2-1', 'fartlek'],
              ['Semaine 5', 'Test VMA pour ajuster tes allures', 'vma-test'],
              ['Semaines 6-8', '2 × 10 × 30/30 puis 5 × 3 min', '30-30-x2'],
            ].map(([w, s, id]) => (
              <button key={w} onClick={() => push({ type: 'workout', workout: PRESETS.find((x) => x.id === id)! })} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left text-sm ring-1 ring-white/10">
                <div className="w-24 shrink-0 font-semibold text-amber">{w}</div>
                <div className="flex-1">{s}</div>
                <div className="text-white/30">›</div>
              </button>
            ))}
          </div>
          <p>
            Le reste de la semaine : <b>footings lents</b> (70% VMA). Environ 80% de ton volume doit être facile.
          </p>
        </Section>

        <Section n="7" title="Les erreurs à éviter">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Partir trop vite sur la 1ʳᵉ répétition (l’erreur n°1).</li>
            <li>Sauter l’échauffement : c’est là que se cachent les blessures.</li>
            <li>Faire du fractionné tous les jours : 1 séance/semaine (2 max si tu cours 4 fois ou plus), jamais deux jours de suite.</li>
            <li>S’arrêter net pendant la récup : trottine pour éliminer.</li>
            <li>Ignorer une douleur : une gêne qui augmente pendant l’effort = on arrête.</li>
          </ul>
          <Tip color="#ff3b5c">Douleur thoracique, vertige, essoufflement anormal : stop immédiat. Si tu reprends le sport, as des antécédents cardiaques ou plus de 40 ans sans suivi, un avis médical avant le fractionné est une bonne idée.</Tip>
        </Section>

        <button onClick={() => launch('30-30-debutant')} className="mt-8 h-14 w-full rounded-2xl bg-hot font-display text-2xl uppercase">
          Je me lance : 30/30 découverte
        </button>
      </div>
    </div>
  )
}

export function BackgroundHelp() {
  return (
    <div className="pb-20">
      <Header title="Écran éteint & GPS" onBack={pop} />
      <div className="space-y-4 px-4 text-[15px] leading-relaxed text-white/75">
        <Tip color="#ffb020">
          <b>Ce qu’il faut savoir :</b> sur iPhone, Apple ne laisse <b>aucune</b> appli web (PWA) utiliser le GPS quand l’écran est verrouillé ou l’appli fermée. C’est une limite d’iOS, pas de RunForest. Seules les applis natives de l’App Store (Strava, Nike Run…) le peuvent.
        </Tip>
        <div>
          <h3 className="font-display text-xl uppercase text-white">Ce que fait RunForest pour compenser</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <b>Écran toujours allumé</b> pendant la course (verrou d’écran automatique). Ton iPhone ne se met pas en veille tout seul.
            </li>
            <li>
              <b>🔒 Mode poche</b> : écran noir (quasi aucune conso sur les écrans OLED), tactile bloqué, déverrouillage par appui long. C’est ce qu’il faut utiliser à la place du bouton de verrouillage.
            </li>
            <li>
              <b>Rien n’est perdu</b> : la course est sauvegardée en continu. Si tu fermes l’appli, réponds à un appel ou verrouilles par erreur, rouvre RunForest : la course reprend toute seule, le chrono a continué et le morceau manquant est recollé en ligne droite (affiché en pointillés gris).
            </li>
            <li>Le fractionné rattrape aussi les étapes écoulées pendant ton absence.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-xl uppercase text-white">Réglages iPhone conseillés</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Installe l’appli sur l’écran d’accueil (Safari → Partager → Sur l’écran d’accueil) et lance-la depuis l’icône.</li>
            <li>Réglages › Confidentialité › Service de localisation › Sites web Safari : « Lorsque l’app est active » + <b>Position exacte</b> activée.</li>
            <li>Désactive le mode Économie d’énergie pendant la course (il peut couper le verrou d’écran).</li>
            <li>Luminosité au minimum + mode poche = batterie préservée.</li>
            <li>Pour la musique : lance-la avant, les annonces vocales passent par-dessus.</li>
          </ul>
        </div>
        <Tip>
          Astuce : pour tester l’appli sans sortir, active le <b>GPS de démo</b> dans Profil › Réglages. Un coureur virtuel tourne en boucle autour de ta position (ou de Paris).
        </Tip>
      </div>
    </div>
  )
}

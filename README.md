# RunForest 🏃‍♂️🌲

Appli de course à pied (PWA iOS/Android) : suivi GPS, tracé, allure, fantôme, fractionné guidé avec coach vocal, radar façon GTA, XP, niveaux et trophées.

**→ https://engob.github.io/RunForest/**

## Fonctionnalités

- **Suivi GPS** : temps, distance, allure instantanée/moyenne, vitesse, vitesse max, D+, calories, temps au km, meilleurs 1/5/10 km.
- **Radar GTA** : mini-carte circulaire orientée dans ta direction, tracé, fantôme, barres de progression (étape/km et objectif hebdo). Toucher = carte plein écran.
- **Fantôme** : cours contre n'importe quelle course passée (ou un GPX importé de Strava/Garmin). Écart en secondes et en mètres, annonces quand il te double.
- **Fractionné** : 9 séances prêtes (30/30, 10×400, 6×1000, pyramide, fartlek, seuil…), constructeur de séances, **test VMA** demi-Cooper intégré, allures cibles calculées depuis ta VMA, coach vocal + bips 3-2-1, indicateur « accélère / trop vite », guide complet.
- **Gamification** : écran HUD, étoiles d'intensité, « Mission accomplie », XP, niveaux, 18 trophées, objectif hebdo, série de jours.
- **Historique** : carte colorée par vitesse, graphique, temps au km, détail des intervalles, export GPX, sauvegarde/restauration JSON.
- **Mode poche** 🔒 : écran noir anti-touches, l'écran reste allumé.
- **GPS de démo** (Profil › Réglages) pour tester chez soi.

## ⚠️ Écran éteint sur iPhone

iOS ne donne **pas** accès au GPS aux applis web quand l'écran est verrouillé ou l'appli fermée (seules les applis App Store le peuvent). RunForest compense :

- l'écran reste allumé automatiquement pendant la course + **mode poche** (écran noir) ;
- la course est sauvegardée en continu : si l'appli est fermée/verrouillée, elle **reprend à la réouverture**, le chrono a continué et le trou est recollé en ligne droite.

## Installation sur iPhone

Safari → https://engob.github.io/RunForest/ → Partager → **Sur l'écran d'accueil**. Autorise la localisation (« Position exacte » activée).

## Dev

```bash
npm install
npm run dev      # http://localhost:5173/RunForest/
npm run build
```

Stack : Vite, React 19, TypeScript, Tailwind CSS 4, Leaflet (tuiles CARTO dark), vite-plugin-pwa, IndexedDB.

Déploiement : GitHub Actions → GitHub Pages à chaque push sur `main` (Settings › Pages › Source : **GitHub Actions**).

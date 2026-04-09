# Deploiement iOS - App Store

## Pre-requis

### Compte & Certificats
- [❌] Compte Apple Developer (99$/an) — [developer.apple.com](https://developer.apple.com)
- [✅] EAS CLI installe (`npm install -g eas-cli`)
- [❌] Login EAS (`eas login`)
- [❌] Certificats & Provisioning configures (`eas credentials` — automatique)

### Backend en production
- [❌] Serveur heberge (VPS, Railway, Fly.io, Render, etc.)
- [❌] PostgreSQL + PostGIS en production
- [❌] Redis en production
- [❌] Variables d'environnement configurees :

```env
# Obligatoire
DATABASE_URL=postgresql://user:password@host:5432/volleyfinder
JWT_SECRET=une-cle-secrete-de-32-caracteres-minimum
ALLOWED_ORIGINS=https://ton-domaine.com

# Optionnel (valeurs par defaut)
NODE_ENV=production
PORT=3000
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_URL=redis://host:6379
BCRYPT_ROUNDS=12

# Firebase (push notifications)
FIREBASE_PROJECT_ID=ton-project-id
FIREBASE_PRIVATE_KEY=ta-cle-privee
FIREBASE_CLIENT_EMAIL=ton-email@project.iam.gserviceaccount.com
```

- [❌] API accessible via HTTPS (certificat SSL)
- [❌] Variable mobile `EXPO_PUBLIC_API_URL` pointe vers l'API production

### Assets obligatoires
- [❌] Icone 1024x1024px (PNG, sans transparence, sans coins arrondis)
- [❌] Screenshots iPhone 6.7" (iPhone 15 Pro Max) — 2 a 5 images, 1290x2796px
- [❌] Screenshots iPhone 6.1" (iPhone 15) — 2 a 5 images, 1179x2556px
- [❌] Optimiser `logo.png` (actuellement 997KB, reduire a ~100KB)

### Pages legales (obligatoire Apple)
- [❌] Politique de confidentialite — page web hebergee (URL publique)
- [❌] Conditions d'utilisation — page web hebergee (URL publique)
- [❌] URL de support / contact

### Fiche App Store Connect
- [❌] Creer l'app dans [App Store Connect](https://appstoreconnect.apple.com)
- [❌] Nom de l'app : VolleyHub
- [❌] Categorie principale : Sports
- [❌] Description courte (30 caracteres max pour le sous-titre)
- [❌] Description longue (4000 caracteres max)
- [❌] Mots-cles (100 caracteres max, separes par des virgules)
- [❌] Classification d'age (questionnaire Apple)
- [❌] Ajouter les URLs : politique de confidentialite, support, site web

### Privacy Manifest (iOS 17+)
Apple exige une declaration des APIs sensibles utilisees par l'app :
- [❌] Localisation (NSLocationWhenInUseUsageDescription)
- [❌] Camera (NSCameraUsageDescription)
- [❌] Photos (NSPhotoLibraryUsageDescription)
- [❌] Notifications push
- [❌] UserDefaults / SecureStore

Ajouter dans `app.json` > `expo` > `ios` > `privacyManifests` si necessaire.

---

## Configuration EAS

### eas.json (deja configure)
Le fichier `eas.json` contient les profils `development`, `preview` et `production`.
Le profil `production` a `autoIncrement: true` pour incrementer le build number automatiquement.

### app.json — ajouter avant le build
Ajouter les URLs legales dans `expo.ios` :
```json
{
  "expo": {
    "ios": {
      "privacyUrl": "https://ton-site.com/privacy",
      "termsUrl": "https://ton-site.com/terms"
    }
  }
}
```

---

## Commandes de deploiement

### 1. Configurer les credentials iOS (premiere fois uniquement)
```bash
eas credentials
```
EAS genere automatiquement les certificats de distribution et le provisioning profile.

### 2. Build iOS production
```bash
eas build --platform ios --profile production
```
Le build prend ~10-20 minutes sur les serveurs EAS.

### 3. Submit sur l'App Store
```bash
eas submit --platform ios --profile production
```
Cela upload le build sur App Store Connect. Il faut ensuite aller dans App Store Connect pour soumettre a la review.

### 4. Soumettre a la review
1. Aller sur [App Store Connect](https://appstoreconnect.apple.com)
2. Selectionner l'app
3. Ajouter les screenshots, description, mots-cles
4. Selectionner le build uploade
5. Repondre au questionnaire de classification
6. Soumettre pour review

La review Apple prend generalement 24-48h.

---

## Checklist finale avant submission

- [❌] Backend en production, accessible, HTTPS
- [❌] Tester l'app avec l'API production (pas localhost)
- [❌] Push notifications fonctionnelles (Firebase configure)
- [❌] Toutes les permissions declarees dans Info.plist
- [❌] Politique de confidentialite et CGU en ligne
- [❌] Icone et screenshots prets
- [❌] Fiche App Store remplie (description, mots-cles, categorie)
- [❌] Classification d'age completee
- [❌] Build production effectue sans erreur
- [❌] Tester le build sur un vrai iPhone (pas simulateur)

---

## Erreurs courantes de review Apple

| Raison de rejet | Solution |
|---|---|
| Pas de politique de confidentialite | Heberger une page et ajouter l'URL |
| Crash au lancement | Tester le build production sur vrai device |
| Backend inaccessible | Verifier que l'API est en ligne et HTTPS |
| Permissions non justifiees | Expliquer pourquoi chaque permission est necessaire |
| Contenu insuffisant | S'assurer que l'app a assez de fonctionnalites |
| Login obligatoire sans raison | Proposer un apercu sans compte si possible |
| Screenshots trompeuses | Utiliser des captures reelles de l'app |

---

## Mise a jour de l'app

Pour publier une mise a jour :
```bash
# Mise a jour OTA (JS uniquement, pas de changement natif)
eas update --branch production

# Nouveau build (si changement natif : nouvelles libs, permissions, etc.)
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Les mises a jour OTA via `eas update` sont instantanees (pas de review Apple).
Les nouveaux builds natifs passent par la review (~24-48h).

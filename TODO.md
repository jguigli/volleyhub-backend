TODO


frontend :
✅ Map -> Page Pin dans Create Match -> le pin doit etre directement sur ma localisation
✅ faire un inventaire des composants existants -> automatiser config tailwind (couleur etc) -> theme/color.ts
✅ faire config pour changer la langue settings
❌
❌
❌
❌
❌
❌

backend :
✅ faire un seed pour peupler qques matchs
❌
❌
❌
❌
❌
❌


Nom appli :

RallyUp → dynamique et volley-native
NetMates → social + volley subtil
VolleyHub → parfait pour une plateforme


==============================================


L'utilisateur peut creer que 1 match/tournois toutes les 24h, il peut creer/supprimer uniquement 3 matchs toutes les 24h. pour eviter les abus.



A faire avec claude :

--------------------------------------- check utilisation redis :
C'est fait. Voici le résumé des améliorations Redis :

Nouveau dans RedisService :

getJson<T>() / setJson() — sérialisation/désérialisation automatique
delPattern() — suppression par pattern (remplace keys() + del())
Cache profil utilisateur (5 min TTL) :

Clé : user:profile:{userId}
Cache les 3 queries DB (user + followers count + following count)
Invalidé sur : update profil, follow, unfollow
Cache stats utilisateur (1h TTL) :

Clé : user:{userId}:stats:{format}
Cache les 2 queries DB complexes (compteurs + historique victoires)
Invalidé sur : join match, leave match, delete match
Invalidation centralisée :

invalidateMatchCaches() — nettoie count + nearby + stats participants
invalidateUserStats() — nettoie toutes les variantes de stats d'un user
Nettoyé :

Feature courts à proximité supprimée (backend endpoint, service, DTO, API mobile, hook)


--------------------------------------- check faille de secu

Corrections appliquées
CRITIQUES
1. JWT secret — Supprimé le fallback 'fallback_secret' dans app.config.ts et jwt.strategy.ts. L'app crash au démarrage si JWT_SECRET n'est pas défini dans l'environnement.

2. CORS — Remplacé origin: '*' par une liste configurable via ALLOWED_ORIGINS (env var). Appliqué sur l'API REST (main.ts) ET les WebSockets (matches.gateway.ts).

3. DB credentials — Supprimé le fallback postgresql://volley:volley_secret@.... L'app crash si DATABASE_URL n'est pas défini.

HAUTS
4. Rate limiting — Installé @nestjs/throttler. Limites :

Global : 100 req/min par IP
Login : 10 tentatives/min
Register : 5/heure
Refresh : 30/min
5. Refresh tokens — Implémenté le mécanisme complet :

Access token : 1h (au lieu de 7j)
Refresh token : 7j, avec claim type: 'refresh'
Endpoint POST /auth/refresh
La JWT strategy rejette les refresh tokens utilisés comme access tokens
Le client mobile auto-refresh sur 401 avec queue des requêtes pendantes
6. Stockage sécurisé mobile — Remplacé AsyncStorage (texte clair) par expo-secure-store (chiffré par le Keychain iOS / Keystore Android). Stocke token, refresh token et user.

7. Helmet — Installé et configuré. Ajoute automatiquement les headers de sécurité : X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection, etc.

MOYENS
8. bcrypt configurable — Rounds configurables via BCRYPT_ROUNDS (défaut : 12).

9. JWT validation renforcée — La strategy vérifie le claim type pour empêcher l'utilisation de refresh tokens comme access tokens.

10. .env.example — Créé pour documenter toutes les variables requises/optionnelles.

11. Bug fix — Corrigé l'ordre de déclaration de isLive dans MatchTeamsBoardScreen.tsx.

--------------------------------------- check ce qu'il reste a faire pour deployer sur apple et android
-> Sur Android, react-native-maps utilise Google Maps par défaut. C'est gratuit jusqu'à 28 000 chargements de carte/mois (200$ de crédit offert par Google chaque mois), ce qui est largement suffisant pour une app en lancement.

Donc tu as déjà le bon setup :

iOS : Apple Maps (natif, gratuit, illimité)
Android : Google Maps (gratuit avec le crédit mensuel)
Tu n'as rien à changer. Tu as juste besoin d'une clé API Google Maps dans ton AndroidManifest.xml / app.json pour Android. Tu l'as déjà configurée ?


--------------------------------------- est ce que c'est censé marcher avec android la ?
Oui manque la cle google map dans app.json


--------------------------------------- qu'est ce qui me manque dans l'app
--------------------------------------- comment rajouter des pubs et sur quelles actions
--------------------------------------- Comment faire des abonnements payants

--------------------------------------- penser a gerer le point de repere localisation (dev/prod)
--------------------------------------- changer le nom de l'appli -> VolleyHub










==========================================================

Quand recreation match ca met l’event créé en terminé ! (constat: ca remet pas tout les joueurs automatiquement dans l’equipe dans laquelle ils etaient avant, du coup risque d’eauipe vide au demarrage du renouvellement du match)
Sur android, la barre du chat de groupe en bas remonte pas

Notif : slide vers la gauche pour supprimer -> enleve la croix rouge



est ce que si un match s'anulle pour manque de joueurs ca me compte pour un event joués ?